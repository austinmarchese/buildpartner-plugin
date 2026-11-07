// State contract for the BuildPartner.ai Assistant mod (hooks/assistant.tsx).
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

export type AssistantCursor = {
  sessionId: string
  upTo: number
}

export type AssistantExpert = {
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
export type AssistantHealth = {
  /** This plugin's version, from its own plugin.json. */
  version: string | null
  /** Newest published version on this plugin's channel; null when unknown. */
  latest: string | null
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
  /** When these were gathered (epoch ms). */
  at: number
}

/** The member's plan, read from BuildPartner.ai (GET /api/buildpartner/plan). */
export type AssistantPlan = {
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

declare module 'claude-code' {
  interface PluginState {
    'bp-dev': {
      pending: Shaped<ReflectPattern[]>
      watching: Shaped<ReflectPattern[]>
      isEnabled: boolean
      busySince: number
      isHidden: boolean
      turns: number
      cursor: Shaped<AssistantCursor | null>
      lastReviewAt: number
      last: Shaped<ReflectRun | null>
      isExpanded: boolean
      tick: number
      bpTools: Shaped<string[]>
      hiddenItems: Shaped<string[]>
      expert: Shaped<AssistantExpert | null>
      health: Shaped<AssistantHealth | null>
      scanned: boolean
      plan: Shaped<AssistantPlan | null>
      previewAs: string
      isScanning: boolean
      appliedNow: Shaped<string[]>
    }
  }
}
