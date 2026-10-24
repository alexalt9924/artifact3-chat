export type Role = 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  error?: boolean
  /** Set when the reply hit a token limit: the per-reply cap, or the end of the chat's context window. */
  cutOff?: 'reply' | 'context'
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  updatedAt: number
}
