export interface BrowserDiscoveryJobRequest {
  jobId: string
  websiteUrl: string
  priorityPages?: string[]
}

export interface PageNavigationTelemetry {
  url: string
  navigationStartedAt: string
  navigationCompletedAt: string | null
  navigationDurationMs: number | null
  candidateCount: number
  error: string | null
}

export interface BrowserTelemetry {
  browserRuntimeMode: string
  browserAvailable: boolean
  browserExecutableResolved: string
  browserLaunchStartedAt: string
  browserLaunchedAt: string | null
  pagesRequested: number
  pagesCrawled: number
  perPage: PageNavigationTelemetry[]
  browserCandidates: number
  browserOnlyCandidates: number
  browserDurationMs: number
  browserErrorCode: string | null
  browserErrorMessage: string | null
}
