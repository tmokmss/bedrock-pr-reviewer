import {info, warning} from '@actions/core'
// eslint-disable-next-line camelcase
import {context as github_context} from '@actions/github'
import {type Bot} from './bot'
import {
  Commenter,
  COMMENT_REPLY_TAG,
  COMMENT_TAG,
  SUMMARIZE_TAG
} from './commenter'
import {Inputs} from './inputs'
import {octokit} from './octokit'
import {type Options} from './options'
import {type Prompts} from './prompts'
import {getTokenCount} from './tokenizer'
import {codeReview, reviewSpecificFiles} from './review'

// eslint-disable-next-line camelcase
const context = github_context
const repo = context.repo
const ASK_BOT = '/reviewbot'

interface Command {
  type: 'review_all' | 'review_files' | 'summarize' | 'unknown'
  files?: string[]
}

function parseCommand(commentBody: string): Command {
  const lines = commentBody.split('\n')
  for (const line of lines) {
    if (line.trim().startsWith('/reviewbot')) {
      const parts = line.trim().split(' ')
      if (parts.length >= 2) {
        if (parts[1] === 'review') {
          if (parts.length >= 3 && parts[2] === 'all') {
            return {type: 'review_all'}
          } else if (parts.length >= 3) {
            return {type: 'review_files', files: parts.slice(2)}
          }
        } else if (parts[1] === 'summarize') {
          return {type: 'summarize'}
        }
      }
    }
  }
  return {type: 'unknown'}
}

export const handleReviewComment = async (
  heavyBot: Bot,
  options: Options,
  prompts: Prompts
) => {
  const commenter: Commenter = new Commenter()
  const inputs: Inputs = new Inputs()

  if (context.eventName !== 'pull_request_review_comment') {
    warning(
      `Skipped: ${context.eventName} is not a pull_request_review_comment event`
    )
    return
  }

  if (!context.payload) {
    warning(`Skipped: ${context.eventName} event is missing payload`)
    return
  }

  const comment = context.payload.comment
  if (comment == null) {
    warning(`Skipped: ${context.eventName} event is missing comment`)
    return
  }
  if (
    context.payload.pull_request == null ||
    context.payload.repository == null
  ) {
    warning(`Skipped: ${context.eventName} event is missing pull_request`)
    return
  }
  inputs.title = context.payload.pull_request.title
  if (context.payload.pull_request.body) {
    inputs.description = commenter.getDescription(
      context.payload.pull_request.body
    )
  }

  // check if the comment was created and not edited or deleted
  if (context.payload.action !== 'created') {
    warning(`Skipped: ${context.eventName} event is not created`)
    return
  }

  // Check if the comment is not from the bot itself
  if (
    !comment.body.includes(COMMENT_TAG) &&
    !comment.body.includes(COMMENT_REPLY_TAG)
  ) {
    const pullNumber = context.payload.pull_request.number

    inputs.comment = `${comment.user.login}: ${comment.body}`
    inputs.diff = comment.diff_hunk
    inputs.filename = comment.path

    const {chain: commentChain, topLevelComment} =
      await commenter.getCommentChain(pullNumber, comment)

    if (!topLevelComment) {
      warning('Failed to find the top-level comment to reply to')
      return
    }

    inputs.commentChain = commentChain

    // check whether this chain contains replies from the bot
    if (
      commentChain.includes(COMMENT_TAG) ||
      commentChain.includes(COMMENT_REPLY_TAG) ||
      comment.body.includes(ASK_BOT)
    ) {
      let fileDiff = ''
      try {
        // get diff for this file by comparing the base and head commits
        const diffAll = await octokit.repos.compareCommits({
          owner: repo.owner,
          repo: repo.repo,
          base: context.payload.pull_request.base.sha,
          head: context.payload.pull_request.head.sha
        })
        if (diffAll.data) {
          const files = diffAll.data.files
          if (files != null) {
            const file = files.find(f => f.filename === comment.path)
            if (file != null && file.patch) {
              fileDiff = file.patch
            }
          }
        }
      } catch (error) {
        warning(`Failed to get file diff: ${error}, skipping.`)
      }

      // use file diff if no diff was found in the comment
      if (inputs.diff.length === 0) {
        if (fileDiff.length > 0) {
          inputs.diff = fileDiff
          fileDiff = ''
        } else {
          await commenter.reviewCommentReply(
            pullNumber,
            topLevelComment,
            'Cannot reply to this comment as diff could not be found.'
          )
          return
        }
      }

      // get tokens so far
      let tokens = getTokenCount(prompts.renderComment(inputs))

      if (tokens > options.heavyTokenLimits.requestTokens) {
        await commenter.reviewCommentReply(
          pullNumber,
          topLevelComment,
          'Cannot reply to this comment as diff being commented is too large and exceeds the token limit.'
        )
        return
      }
      // pack file diff into the inputs if they are not too long
      if (fileDiff.length > 0) {
        // count occurrences of $file_diff in prompt
        const fileDiffCount = prompts.comment.split('$file_diff').length - 1
        const fileDiffTokens = getTokenCount(fileDiff)
        if (
          fileDiffCount > 0 &&
          tokens + fileDiffTokens * fileDiffCount <=
            options.heavyTokenLimits.requestTokens
        ) {
          tokens += fileDiffTokens * fileDiffCount
          inputs.fileDiff = fileDiff
        }
      }

      // get summary of the PR
      const summary = await commenter.findCommentWithTag(
        SUMMARIZE_TAG,
        pullNumber
      )
      if (summary) {
        // pack short summary into the inputs if it is not too long
        const shortSummary = commenter.getShortSummary(summary.body)
        const shortSummaryTokens = getTokenCount(shortSummary)
        if (
          tokens + shortSummaryTokens <=
          options.heavyTokenLimits.requestTokens
        ) {
          tokens += shortSummaryTokens
          inputs.shortSummary = shortSummary
        }
      }

      inputs.commentChain = inputs.commentChain
        .replace(COMMENT_TAG, '')
        .replace(COMMENT_REPLY_TAG, '')

      const [reply] = await heavyBot.chat(prompts.renderComment(inputs))

      await commenter.reviewCommentReply(pullNumber, topLevelComment, reply)
    }
  } else {
    info(`Skipped: ${context.eventName} event is from the bot itself`)
  }
}

export const handleCommand = async (
  lightBot: Bot,
  heavyBot: Bot,
  options: Options,
  prompts: Prompts
): Promise<void> => {
  const commenter: Commenter = new Commenter()

  info(`handleCommand called with event: ${context.eventName}`)
  info(`Payload keys: ${Object.keys(context.payload || {})}`)

  if (context.eventName !== 'issue_comment') {
    warning(`Skipped: ${context.eventName} is not an issue_comment event`)
    return
  }

  if (!context.payload || !context.payload.comment) {
    warning(`Skipped: ${context.eventName} event is missing comment payload`)
    return
  }

  const comment = context.payload.comment
  const commentBody = comment.body

  info(`Comment body: ${commentBody}`)
  info(`Comment user: ${comment.user?.login}`)

  // Check if this is a pull request comment
  if (!context.payload.issue || !context.payload.issue.pull_request) {
    warning('Skipped: comment is not on a pull request')
    return
  }

  // Check if the comment contains /reviewbot command
  if (!commentBody.includes('/reviewbot')) {
    info('Skipped: comment does not contain /reviewbot command')
    return
  }

  // Check if the comment is from the bot itself (avoid infinite loops)
  if (comment.user.login === 'github-actions[bot]') {
    info('Skipped: comment is from the bot itself')
    return
  }

  const command = parseCommand(commentBody)
  const pullNumber = context.payload.issue.number

  try {
    switch (command.type) {
      case 'review_all':
        await commenter.comment(
          'Starting full PR review as requested...',
          COMMENT_TAG,
          'create'
        )
        await codeReview(lightBot, heavyBot, options, prompts)
        break
      case 'review_files':
        if (command.files && command.files.length > 0) {
          await reviewSpecificFiles(
            command.files,
            lightBot,
            heavyBot,
            options,
            prompts
          )
        } else {
          await commenter.comment(
            'Please specify files to review. Example: `/reviewbot review file1.ts file2.ts`',
            COMMENT_TAG,
            'create'
          )
        }
        break
      case 'summarize':
        await commenter.comment(
          'Generating PR summary...',
          COMMENT_TAG,
          'create'
        )
        // TODO: Implement summarize-only function
        info('Summary requested')
        await commenter.comment(
          'Summary-only feature is not yet implemented. Use `/reviewbot review all` for now.',
          COMMENT_TAG,
          'create'
        )
        break
      default:
        await commenter.comment(
          'Unknown command. Available commands:\n- `/reviewbot review all` - Full PR review\n- `/reviewbot review file1 file2` - Review specific files\n- `/reviewbot summarize` - Generate summary only',
          COMMENT_TAG,
          'create'
        )
    }
  } catch (error: any) {
    warning(`Error handling command: ${error.message}`)
    await commenter.comment(
      `Error processing command: ${error.message}`,
      COMMENT_TAG,
      'create'
    )
  }
}
