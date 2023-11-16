import {info} from '@actions/core'
import {minimatch} from 'minimatch'
import {TokenLimits} from './limits'

export class Options {
  debug: boolean
  disableReview: boolean
  disableReleaseNotes: boolean
  onlyAllowCollaborator: boolean
  maxFiles: number
  reviewSimpleChanges: boolean
  reviewCommentLGTM: boolean
  pathFilters: PathFilter
  systemMessage: string
  reviewFileDiff: string
  bedrockLightModel: string
  bedrockHeavyModel: string
  bedrockModelTemperature: number
  bedrockRetries: number
  bedrockTimeoutMS: number
  bedrockConcurrencyLimit: number
  githubConcurrencyLimit: number
  lightTokenLimits: TokenLimits
  heavyTokenLimits: TokenLimits
  language: string

  constructor(
    debug: boolean,
    disableReview: boolean,
    disableReleaseNotes: boolean,
    onlyAllowCollaborator: boolean,
    maxFiles = '0',
    reviewSimpleChanges = false,
    reviewCommentLGTM = false,
    pathFilters: string[] | null = null,
    systemMessage = '',
    reviewFileDiff = '',
    bedrockLightModel: string,
    bedrockHeavyModel: string,
    bedrockModelTemperature = '0.0',
    bedrockRetries = '3',
    bedrockTimeoutMS = '120000',
    bedrockConcurrencyLimit = '6',
    githubConcurrencyLimit = '6',
    language = 'en-US'
  ) {
    this.debug = debug
    this.disableReview = disableReview
    this.disableReleaseNotes = disableReleaseNotes
    this.onlyAllowCollaborator = onlyAllowCollaborator
    this.maxFiles = parseInt(maxFiles)
    this.reviewSimpleChanges = reviewSimpleChanges
    this.reviewCommentLGTM = reviewCommentLGTM
    this.pathFilters = new PathFilter(pathFilters)
    this.systemMessage = systemMessage
    this.reviewFileDiff = reviewFileDiff
    this.bedrockLightModel = bedrockLightModel
    this.bedrockHeavyModel = bedrockHeavyModel
    this.bedrockModelTemperature = parseFloat(bedrockModelTemperature)
    this.bedrockRetries = parseInt(bedrockRetries)
    this.bedrockTimeoutMS = parseInt(bedrockTimeoutMS)
    this.bedrockConcurrencyLimit = parseInt(bedrockConcurrencyLimit)
    this.githubConcurrencyLimit = parseInt(githubConcurrencyLimit)
    this.lightTokenLimits = new TokenLimits(bedrockLightModel)
    this.heavyTokenLimits = new TokenLimits(bedrockHeavyModel)
    this.language = language
  }

  // print all options using core.info
  print(): void {
    info(`debug: ${this.debug}`)
    info(`disable_review: ${this.disableReview}`)
    info(`disable_release_notes: ${this.disableReleaseNotes}`)
    info(`only_allow_collaborator: ${this.onlyAllowCollaborator}`)
    info(`max_files: ${this.maxFiles}`)
    info(`review_simple_changes: ${this.reviewSimpleChanges}`)
    info(`review_comment_lgtm: ${this.reviewCommentLGTM}`)
    info(`path_filters: ${this.pathFilters}`)
    info(`system_message: ${this.systemMessage}`)
    info(`review_file_diff: ${this.reviewFileDiff}`)
    info(`bedrock_light_model: ${this.bedrockLightModel}`)
    info(`bedrock_heavy_model: ${this.bedrockHeavyModel}`)
    info(`bedrock_model_temperature: ${this.bedrockModelTemperature}`)
    info(`bedrock_retries: ${this.bedrockRetries}`)
    info(`bedrock_timeout_ms: ${this.bedrockTimeoutMS}`)
    info(`bedrock_concurrency_limit: ${this.bedrockConcurrencyLimit}`)
    info(`github_concurrency_limit: ${this.githubConcurrencyLimit}`)
    info(`summary_token_limits: ${this.lightTokenLimits.string()}`)
    info(`review_token_limits: ${this.heavyTokenLimits.string()}`)
    info(`language: ${this.language}`)
  }

  checkPath(path: string): boolean {
    const ok = this.pathFilters.check(path)
    info(`checking path: ${path} => ${ok}`)
    return ok
  }
}

export class PathFilter {
  private readonly rules: Array<[string /* rule */, boolean /* exclude */]>

  constructor(rules: string[] | null = null) {
    this.rules = []
    if (rules != null) {
      for (const rule of rules) {
        const trimmed = rule?.trim()
        if (trimmed) {
          if (trimmed.startsWith('!')) {
            this.rules.push([trimmed.substring(1).trim(), true])
          } else {
            this.rules.push([trimmed, false])
          }
        }
      }
    }
  }

  /**
   * Returns true if the file should be processed, not ignored.
   * If there is any inclusion rule set, a file is included when it matches any of inclusion rule.
   * If there is no inclusion rule set, a file is included when it does not matches any of exclusion rule.
   */
  check(path: string): boolean {
    if (this.rules.length === 0) {
      return true
    }

    let included = false
    let excluded = false
    let inclusionRuleExists = false

    for (const [rule, exclude] of this.rules) {
      if (minimatch(path, rule)) {
        if (exclude) {
          excluded = true
        } else {
          included = true
        }
      }
      if (!exclude) {
        inclusionRuleExists = true
      }
    }

    return (!inclusionRuleExists || included) && !excluded
  }
}

export class BedrockOptions {
  model: string
  tokenLimits: TokenLimits

  constructor(
    model = 'anthropic.claude-instant-v1',
    tokenLimits: TokenLimits | null = null
  ) {
    this.model = model
    if (tokenLimits != null) {
      this.tokenLimits = tokenLimits
    } else {
      this.tokenLimits = new TokenLimits(model)
    }
  }
}
