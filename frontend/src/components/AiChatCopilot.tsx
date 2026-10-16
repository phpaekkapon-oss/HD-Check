import { useState, useRef, useEffect, type FC, type KeyboardEvent } from 'react'
import {
  Bot,
  Sparkles,
  Send,
  X,
  Trash2,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { herbDxApi } from '@/api/herbdx.api'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  role: 'user' | 'model'
  content: string
  modelName?: string
  timestamp: string
}

const QUICK_PROMPTS = [
  { label: '🌿 เกณฑ์พอกเข่า M179', query: 'เกณฑ์การเบิกชดเชยหัตถการพอกเข่า (M179 + U5753) ของ สปสช. มีอะไรบ้าง' },
  { label: '🤱 บริบาลหลังคลอด U506', query: 'เกณฑ์บริบาลหญิงหลังคลอด (M6260 + U506) ต้องลงข้อมูลและรหัสหัตถการอะไรบ้าง' },
  { label: '⚠️ แก้รหัสปิดสิทธิ EP', query: 'รหัสปิดสิทธิ EP ติด Denial สปสช. เพราะอะไร และแก้อย่างไรใน HOSxP' },
  { label: '💊 ยาสมุนไพร 34 รายการ', query: 'ยาสมุนไพร 34 รายการที่ สปสช. สนับสนุนงบประมาณมีอะไรบ้าง และบันทึกอย่างไร' },
]

// Simple robust markdown formatter for chat bubbles
const FormattedMessage: FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n')

  return (
    <div className="space-y-1.5 text-xs sm:text-[13px] leading-relaxed break-words font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />
        }

        // Heading 3: ###
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-sm text-violet-700 dark:text-violet-300 mt-2 mb-1 flex items-center gap-1.5">
              <span>{trimmed.replace('### ', '')}</span>
            </h4>
          )
        }

        // Bullet point: - or *
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.replace(/^[-*]\s+/, '')
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
              <span className="size-1.5 rounded-full bg-violet-500 dark:bg-violet-400 mt-2 shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(itemText) }} />
            </div>
          )
        }

        // Numbered list: 1. 2. 3.
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
        if (numMatch && numMatch[1] && numMatch[2]) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
              <span className="font-semibold text-violet-600 dark:text-violet-400 shrink-0 text-xs">{numMatch[1]}.</span>
              <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(numMatch[2]) }} />
            </div>
          )
        }

        // Standard paragraph
        return (
          <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
        )
      })}
    </div>
  )
}

function formatInlineMarkdown(text: string): string {
  // Escape html tags first
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Bold **text**
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
  // Inline code `code`
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 font-mono text-[11px]">$1</code>')

  return escaped
}

export const AiChatCopilot: FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'model',
      content: `สวัสดีครับ! ผมคือ **AI Smart Copilot** ผู้ช่วยอัจฉริยะประจำระบบ SMART-HOSCHECK โรงพยาบาลพังโคน 

ยินดีช่วยตอบข้อสงสัยเกี่ยวกับการตรวจประเมินเวชระเบียน (Audit), รหัสหัตถการ ICD-10-TM, รหัสปิดสิทธิ EP และเกณฑ์เบิกจ่าย สปสช. ครับ 

คลิกหัวข้อด้านล่างหรือพิมพ์คำถามได้เลยครับ!`,
      modelName: 'Google Gemini AI',
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const quickPromptsRef = useRef<HTMLDivElement>(null)

  const scrollPrompts = (direction: 'left' | 'right') => {
    if (quickPromptsRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180
      quickPromptsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, messages, loading])

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || input).trim()
    if (!textToSend || loading) return

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!customText) setInput('')
    setLoading(true)

    try {
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await herbDxApi.aiChat(textToSend, historyPayload)

      const botMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'model',
        content: res.reply || 'ขออภัย ไม่สามารถประมวลผลคำตอบได้ในขณะนี้',
        modelName: res.model || 'Google Gemini AI',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, botMsg])
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'model',
        content: `⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อ AI: ${(err as Error)?.message || 'โปรดลองใหม่อีกครั้ง'}`,
        modelName: 'System Error',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearMessages = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        content: `เริ่มต้นการสนทนาใหม่แล้วครับ สามารถสอบถามเกณฑ์การแพทย์แผนไทยและระบบ HOSxP ได้เลยครับ`,
        modelName: 'Google Gemini AI',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      },
    ])
  }

  return (
    <>
      {/* Floating Action Button (Launcher): Compact Circular Design matching professional standards */}
      <div className="fixed right-3.5 sm:right-5 lg:right-6 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 z-40 select-none">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? 'ปิดผู้ช่วย AI Chat' : 'เปิดผู้ช่วย AI Chat'}
          className={cn(
            'group relative flex items-center justify-center size-10 sm:size-11 lg:size-12 rounded-full text-white shadow-lg shadow-violet-500/25 ring-2 ring-white/30 backdrop-blur-md transition-all duration-300 cursor-pointer active:scale-95 touch-manipulation',
            'bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 hover:shadow-xl hover:shadow-violet-500/40',
            isOpen ? 'ring-violet-400 rotate-90 scale-95' : 'hover:scale-105'
          )}
        >
          {isOpen ? (
            <X className="size-5 transition-transform" />
          ) : (
            <div className="relative flex items-center justify-center">
              <Bot className="size-5 transition-transform group-hover:rotate-12" />
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-400 ring-2 ring-violet-700 animate-pulse" />
            </div>
          )}

          {/* Desktop Tooltip Tag (floats on the left, does not block clicks) */}
          {!isOpen && (
            <div className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 dark:bg-black/85 text-white text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 border border-white/10 backdrop-blur-xs">
              <Sparkles className="size-3 text-amber-300" />
              <span>ผู้ช่วย AI Copilot</span>
            </div>
          )}
        </button>
      </div>

      {/* Slide-up Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="หน้าต่างสนทนา AI Smart Copilot"
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-20 right-3 sm:right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[420px] md:w-[450px] max-h-[calc(100vh-6rem)] sm:max-h-[640px] flex flex-col rounded-2xl bg-themed-card border border-themed shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-700 via-indigo-700 to-purple-800 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
                <Bot className="size-5 text-amber-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm truncate">AI Smart Copilot</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-1.5 py-0.2 rounded-full">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-violet-200 truncate">
                  โรงพยาบาลพังโคน • แพทย์แผนไทย & HOSxP
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearMessages}
                title="ล้างการสนทนา"
                className="size-8 rounded-lg hover:bg-white/15 flex items-center justify-center text-violet-200 hover:text-white transition-colors cursor-pointer"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="ปิดหน้าต่าง"
                className="size-8 rounded-lg hover:bg-white/15 flex items-center justify-center text-violet-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-4.5" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body with Visible Scrollbar */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-50/60 dark:bg-[#121624]/60 backdrop-blur-xs min-h-[260px] chat-scrollbar">
            {messages.map((m) => {
              const isUser = m.role === 'user'
              return (
                <div
                  key={m.id}
                  className={cn('flex gap-2.5 max-w-[92%]', isUser ? 'ml-auto flex-row-reverse' : 'mr-auto')}
                >
                  <div
                    className={cn(
                      'size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs',
                      isUser
                        ? 'bg-violet-600 text-white'
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-amber-200'
                    )}
                  >
                    {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div
                      className={cn(
                        'p-3 rounded-2xl shadow-xs text-xs sm:text-[13px]',
                        isUser
                          ? 'bg-violet-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-[#1a2035] text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 rounded-tl-none shadow-sm'
                      )}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <FormattedMessage content={m.content} />
                      )}
                    </div>

                    <div
                      className={cn(
                        'flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 px-1',
                        isUser && 'justify-end'
                      )}
                    >
                      {!isUser && m.modelName && (
                        <span className="font-mono text-violet-500 dark:text-violet-400 font-medium">
                          {m.modelName} •
                        </span>
                      )}
                      <span>{m.timestamp}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="flex gap-2.5 mr-auto max-w-[90%]">
                <div className="size-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="size-3.5 animate-spin" />
                </div>
                <div className="p-3 rounded-2xl rounded-tl-none bg-white dark:bg-[#1a2035] border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="size-3.5 animate-spin text-violet-600 dark:text-violet-400" />
                  <span>AI กำลังวิเคราะห์และพิมพ์คำตอบ...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Chips with Interactive Left/Right Controls and Wheel Scroll */}
          <div className="px-2 py-1.5 bg-slate-100/90 dark:bg-[#15192b] border-t border-slate-200/60 dark:border-white/5 flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => scrollPrompts('left')}
              className="size-6 rounded-md bg-white dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center shrink-0 transition shadow-2xs cursor-pointer border border-slate-200/80 dark:border-white/10"
              title="เลื่อนหัวข้อไปทางซ้าย"
              aria-label="เลื่อนหัวข้อไปทางซ้าย"
            >
              <ChevronLeft className="size-3.5" />
            </button>

            <div
              ref={quickPromptsRef}
              onWheel={(e) => {
                if (e.deltaY !== 0) {
                  e.currentTarget.scrollLeft += e.deltaY
                }
              }}
              className="flex-1 flex gap-1.5 overflow-x-auto py-1 scroll-smooth chat-scrollbar shrink-0 select-none"
            >
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSend(qp.query)}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50 shadow-2xs"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollPrompts('right')}
              className="size-6 rounded-md bg-white dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center shrink-0 transition shadow-2xs cursor-pointer border border-slate-200/80 dark:border-white/10"
              title="เลื่อนหัวข้อไปทางขวา"
              aria-label="เลื่อนหัวข้อไปทางขวา"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white dark:bg-[#1a2035] border-t border-themed shrink-0">
            <div className="flex items-end gap-2 bg-slate-50 dark:bg-[#121624] border border-slate-300 dark:border-white/15 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-violet-500/30 focus-within:border-violet-500 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ถามข้อสงสัยเกณฑ์ สปสช. หรือ HOSxP (กด Enter เพื่อส่ง)..."
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent border-0 resize-none text-xs sm:text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 px-2 py-1.5 focus:outline-none max-h-24 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                title="ส่งคำถาม"
                className="size-8 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm cursor-pointer"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1">
              <span>Google Gemini AI • ข้อมูลอ้างอิงเกณฑ์ สปสช.</span>
              <span>กด Shift+Enter ขึ้นบรรทัดใหม่</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
