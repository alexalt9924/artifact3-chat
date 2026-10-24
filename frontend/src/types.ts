export type Role = 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  error?: boolean
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  updatedAt: number
}
