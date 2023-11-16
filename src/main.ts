import {
  getBooleanInput,
  getInput,
  getMultilineInput,
  setFailed,
  warning
} from '@actions/core'
import {Bot} from './bot'
import {BedrockOptions, Options} from './options'
import {Prompts} from './prompts'
import {codeReview} from './review'
import {handleReviewComment} from './review-comment'
import {isCollaborator} from './permission'

async function run(): Promise<void> {
  const options: Options = new Options(
    getBooleanInput('debug'),
    getBooleanInput('disable_review'),
    getBooleanInput('disable_release_notes'),
    getBooleanInput('only_allow_collaborator'),
    getInput('max_files'),
    getBooleanInput('review_simple_changes'),
    getBooleanInput('review_comment_lgtm'),
    getMultilineInput('path_filters'),
    getInput('system_message'),
    getInput('review_file_diff'),
    getInput('bedrock_light_model'),
    getInput('bedrock_heavy_model'),
    getInput('bedrock_model_temperature'),
    getInput('bedrock_retries'),
    getInput('bedrock_timeout_ms'),
    getInput('bedrock_concurrency_limit'),
    getInput('github_concurrency_limit'),
    getInput('language')
  )

  // print options
  options.print()

  const prompts: Prompts = new Prompts(
    getInput('summarize'),
    getInput('summarize_release_notes')
  )

  // Create two bots, one for summary and one for review

  let lightBot: Bot | null = null
  try {
    lightBot = new Bot(
      options,
      new BedrockOptions(options.bedrockLightModel, options.lightTokenLimits)
    )
  } catch (e: any) {
    warning(
      `Skipped: failed to create summary bot, please check your bedrock_api_key: ${e}, backtrace: ${e.stack}`
    )
    return
  }

  let heavyBot: Bot | null = null
  try {
    heavyBot = new Bot(
      options,
      new BedrockOptions(options.bedrockHeavyModel, options.heavyTokenLimits)
    )
  } catch (e: any) {
    warning(
      `Skipped: failed to create review bot, please check your bedrock_api_key: ${e}, backtrace: ${e.stack}`
    )
    return
  }

  try {
    if (
      process.env.GITHUB_ACTOR === undefined ||
      process.env.GITHUB_REPOSITORY === undefined
    ) {
      warning('Skipped: required environment variables not found.')
      return
    }
    if (
      options.onlyAllowCollaborator &&
      !(await isCollaborator(
        process.env.GITHUB_ACTOR,
        process.env.GITHUB_REPOSITORY
      ))
    ) {
      warning(
        `Skipped: The user ${process.env.GITHUB_ACTOR} does not have collaborator access for the repository ${process.env.GITHUB_REPOSITORY}.`
      )
      return
    }
    // check if the event is pull_request
    if (
      process.env.GITHUB_EVENT_NAME === 'pull_request' ||
      process.env.GITHUB_EVENT_NAME === 'pull_request_target'
    ) {
      await codeReview(lightBot, heavyBot, options, prompts)
    } else if (
      process.env.GITHUB_EVENT_NAME === 'pull_request_review_comment'
    ) {
      await handleReviewComment(heavyBot, options, prompts)
    } else {
      warning('Skipped: this action only works on push events or pull_request')
    }
  } catch (e: any) {
    if (e instanceof Error) {
      setFailed(`Failed to run: ${e.message}, backtrace: ${e.stack}`)
    } else {
      setFailed(`Failed to run: ${e}, backtrace: ${e.stack}`)
    }
  }
}

process
  .on('unhandledRejection', (reason, p) => {
    warning(`Unhandled Rejection at Promise: ${reason}, promise is ${p}`)
  })
  .on('uncaughtException', (e: any) => {
    warning(`Uncaught Exception thrown: ${e}, backtrace: ${e.stack}`)
  })

await run()
