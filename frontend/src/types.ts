export type Role = 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  error?: boolean
  /** Set when the reply stopped because the chat's context window ran out. */
  cutOff?: boolean
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  updatedAt: number
}
