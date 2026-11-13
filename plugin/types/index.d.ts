// State contract for the BuildPartner.ai Self-Improving System bar (hooks/self-improving.tsx).
// Ported from Austin's internal-os mod, without the vendored Token Optimizer
// figures (its license forbids shipping them to members).
//
// The PluginState key is this plugin's own name. deploy-dev-plugin.sh rewrites
// 'buildpartner' to 'bp-dev' here and in the mod, since a mod can only write
// state under its own plugin name.

export type ReflectPatternType = 'skill_fix' | 'instruction' | 'new_skill' | 'wiki' | 'framework'

export type ReflectPatternStatus = 'watching' | 'suggested' | 'dismissed' | 'applied'

/** One lesson the reviewer has seen, kept across sessions in $.store. */
export type ReflectPattern = {
  id: string
  type: ReflectPatternType
  /** Repo-relative file the change lands in. */
  target: string
  /** The one-line change, imperative. */
  change: string
  /** A short verbatim quote from the member. */
  evidence: string
  /** Session ids it showed up in. */
  sessions: string[]
  /** Explicit corrections counted for it. */
  corrections: number
  firstSeen: number
  lastSeen: number
  status: ReflectPatternStatus
}

export type ReviewCursor = {
  sessionId: string
  upTo: number
}

/** A BuildPartner.ai tool worth suggesting, from how this session uses Claude's own tools (BP_TOOLS key). */
export type ToolTip = {
  key: 'web' | 'social' | 'pad'
  at: number
}

export type ExpertFlag = {
  category: string
  question: string
  /** 2 to 5 words naming the decision, shown in the bar. Older entries lack it. */
  topic?: string
  at: number
}

export type ReflectRun = {
  at: number
  /** Patterns the run saw. */
  seen: number
  /** Patterns that crossed the bar on this run. */
  promoted: number
  /** Why a run made no call or failed, when it did. */
  note?: string
  /** Tokens the review call used. */
  tokens?: number
}

/** When the member's system last changed: shown in the Health card. */
export type BarHealth = {
  /** This plugin's version, from its own plugin.json. */
  version: string | null
  /** When Claude Code last installed or updated this plugin (ISO). */
  pluginUpdatedAt: string | null
  /** Newest SKILL.md change in this project's .claude/skills (epoch ms). */
  skillsUpdatedAt: number | null
  /** How many project skills there are. */
  skillCount: number
  /** Claude Code's version. */
  ccVersion: string | null
  /** The API the plugin talks to (auth.json api_base, or the default). */
  apiBase: string | null
  /** Whether ~/.buildpartner/auth.json holds a token. */
  isSignedIn: boolean
  /** Who this machine is signed in as (auth.json email, else username). Dev debug only. */
  account?: string | null
  /** When these were gathered (epoch ms). */
  at: number
}

/** The member's plan, read from BuildPartner.ai (GET /api/buildpartner/plan). */
export type MemberPlan = {
  /** Free, Pro, Collaboration or Executive. */
  name: string
  paid: boolean
  /** Free credits left; null on a paid plan. */
  creditsLeft: number | null
  /** An Executive member with a coach. */
  hasCoach: boolean
  /** When it was read (epoch ms). */
  at: number
}

/**
 * An AI Audit run in this session, read from the file the audit writes after each stage
 * (~/.buildpartner/audit/findings.json). It stays on this machine: the bar sends none of it.
 */
export type AuditRun = {
  /** When the run began (epoch ms): a file older than this is an earlier audit's. 0 for a continued run. */
  startedAt: number
  /** When the bar last heard from the run (epoch ms). */
  at: number
  /** The sweep stage last finished, 1 to 6. 0 before the first save, or when the file does not say. */
  stage: number
  /** Findings in the file so far. */
  found: number
  /** The newest finding's title, '' when none. */
  newest: string
  /** The file says the audit finished. */
  isDone: boolean
  /** Dismissed, or the chart was opened: the row stays away for the rest of the run. */
  isAway: boolean
}

/** A notification the BuildPartner.ai team sent to the bar (Admin > Mod, GET /api/buildpartner/mod/notices). */
export type TeamNotice = {
  id: string
  /** 'video' is a new video from Austin: a play mark, and the button opens it. 'prompt': the button fills the prompt box with `prompt`. */
  kind: 'message' | 'video' | 'prompt'
  message: string
  /** The button's label; '' for no button. */
  linkLabel: string
  /** http(s) only; '' for no button, and always '' on a prompt notice. */
  linkHref: string
  /** The prompt a 'prompt' notice hands the member. Missing on notices stored before it existed. */
  prompt?: string
}

/** The first-run welcome card's words: the title and each paragraph under it. */
export type WelcomeText = {
  title: string
  lines: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'buildpartner': {
      pending: Shaped<ReflectPattern[]>
      watching: Shaped<ReflectPattern[]>
      isEnabled: boolean
      busySince: number
      isHidden: boolean
      turns: number
      cursor: Shaped<ReviewCursor | null>
      lastReviewAt: number
      last: Shaped<ReflectRun | null>
      isExpanded: boolean
      tick: number
      bpTools: Shaped<string[]>
      expert: Shaped<ExpertFlag | null>
      toolTip: Shaped<ToolTip | null>
      health: Shaped<BarHealth | null>
      scanned: boolean
      scanDeclined: boolean
      plan: Shaped<MemberPlan | null>
      previewAs: string
      lastError: string
      isScanning: boolean
      appliedNow: Shaped<string[]>
      notices: Shaped<TeamNotice[]>
      isWelcomed: boolean
      welcomeText: Shaped<WelcomeText | null>
      rowAt: number
      upgradeSkipped: boolean
      audit: Shaped<AuditRun | null>
      rolloutOn: boolean
    }
  }
}
