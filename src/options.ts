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
  ignoreKeyword: string
  directoryInstructions: Map<string, string>

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
    language = 'en-US',
    ignoreKeyword = '/reviewbot: ignore'
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
    this.ignoreKeyword = ignoreKeyword
    this.directoryInstructions = this.initializeDirectoryInstructions()
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
    info(`ignore_keyword: ${this.ignoreKeyword}`)
  }

  checkPath(path: string): boolean {
    const ok = this.pathFilters.check(path)
    info(`checking path: ${path} => ${ok}`)
    return ok
  }

  private initializeDirectoryInstructions(): Map<string, string> {
    const instructions = new Map<string, string>()

    // Database operations - Performance critical
    instructions.set(
      'services/coredb/',
      `
**Focus: Performance-critical database operations**
- **Performance Optimization**: Every operation must be optimized for cost and efficiency
- **Memory Management**: Check for memory leaks, proper cleanup, efficient data structures
- **Concurrency**: Ensure thread-safe operations, proper async/await patterns
- **Error Handling**: Robust error handling without performance penalties
- **Benchmarking**: Suggest performance benchmarks for critical paths
    `
    )

    // Gateway/API - Reliability and security
    instructions.set(
      'services/gateway/',
      `
**Focus: API reliability and security**
- **Security**: Authentication, authorization, input validation, rate limiting
- **API Design**: RESTful principles, proper HTTP status codes, consistent response formats
- **Error Handling**: Comprehensive error responses, proper logging
- **Performance**: Request/response optimization, connection pooling
- **Monitoring**: Proper metrics, logging, and observability
    `
    )

    // AI/ML services - Code quality and maintainability
    instructions.set(
      'services/iai/',
      `
**Focus: AI/ML code quality and maintainability**
- **Code Quality**: Clean, readable Python code following PEP 8
- **Type Safety**: Proper type hints, mypy compliance
- **Dependencies**: Minimal, well-maintained dependencies
- **Testing**: Comprehensive unit tests, integration tests
- **Error Handling**: Graceful handling of AI/ML failures
    `
    )

    // Frontend - User experience and performance
    instructions.set(
      'services/iosd/infino-react/',
      `
**Focus: Frontend user experience and performance**
- **Performance**: Bundle size optimization, lazy loading, efficient rendering
- **State Management**: Proper React patterns, minimal re-renders
- **TypeScript**: Strict typing, proper interfaces
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Mobile Responsiveness**: Cross-device compatibility
    `
    )

    // Connector services - Data integration reliability
    instructions.set(
      'services/connector/',
      `
**Focus: Data integration reliability and extensibility**
- **Error Handling**: Robust error handling for external service failures
- **Retry Logic**: Exponential backoff, circuit breakers
- **Data Validation**: Input/output validation, schema compliance
- **Security**: Secure credential handling, data encryption
- **Performance**: Efficient data processing, streaming where possible
    `
    )

    // Instrumentation - Code analysis accuracy
    instructions.set(
      'services/instrumentation/',
      `
**Focus: Code analysis and telemetry accuracy**
- **Accuracy**: Precise code analysis, correct telemetry collection
- **Performance**: Efficient parsing and analysis algorithms
- **Extensibility**: Support for multiple languages and frameworks
- **Privacy**: Proper handling of sensitive code data
- **Testing**: Comprehensive test coverage for analysis accuracy
    `
    )

    // SDK - Usability and consistency
    instructions.set(
      'sdk/',
      `
**Focus: SDK usability and consistency**
- **API Consistency**: Consistent interfaces across languages
- **Documentation**: Comprehensive API documentation, examples
- **Error Handling**: Clear error messages, proper exception handling
- **Performance**: Efficient client implementations
- **Versioning**: Proper semantic versioning, backward compatibility
    `
    )

    // Infrastructure - Reliability and security
    instructions.set(
      'deploy/',
      `
**Focus: Infrastructure reliability and security**
- **Security**: Secure configurations, proper secrets management
- **Scalability**: Auto-scaling configurations, resource optimization
- **Monitoring**: Proper logging, metrics, alerting
- **Documentation**: Clear deployment instructions
- **Testing**: Infrastructure testing, validation scripts
    `
    )

    instructions.set(
      'terraform/',
      `
**Focus: Infrastructure as Code best practices**
- **Security**: Secure configurations, proper secrets management
- **Resource Management**: Efficient resource allocation, cost optimization
- **Modularity**: Reusable modules, proper organization
- **State Management**: Proper state handling, backup strategies
- **Documentation**: Clear variable descriptions, usage examples
    `
    )

    // Tests - Quality and coverage
    instructions.set(
      'tests/',
      `
**Focus: Test quality and coverage**
- **Coverage**: Adequate test coverage for critical paths
- **Quality**: Meaningful tests, proper assertions
- **Performance**: Fast test execution, proper test isolation
- **Maintainability**: Clear test structure, reusable test utilities
    `
    )

    // Utils - Reusability and efficiency
    instructions.set(
      'utils/',
      `
**Focus: Utility code reusability and efficiency**
- **Reusability**: Generic, well-documented utilities
- **Performance**: Efficient implementations
- **Testing**: Comprehensive test coverage
- **Documentation**: Clear usage examples and documentation
    `
    )

    return instructions
  }

  getDirectoryInstructions(filePath: string): string {
    // Find the most specific matching directory
    let bestMatch = ''
    let bestInstruction = ''

    for (const [dirPath, instruction] of this.directoryInstructions) {
      if (filePath.startsWith(dirPath) && dirPath.length > bestMatch.length) {
        bestMatch = dirPath
        bestInstruction = instruction
      }
    }

    return (
      bestInstruction ||
      'Apply general code review principles focusing on bugs, security, performance, and maintainability.'
    )
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
