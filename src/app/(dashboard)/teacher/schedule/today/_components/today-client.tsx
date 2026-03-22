'use client'

import { useState, useEffect } from 'react'
import { Plus, Check, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Todo = {
  id: string
  text: string
  done: boolean
}

type Props = {
  userId: string
}

const STORAGE_KEY_PREFIX = 'teacher_todos_'

export function TodayTodoList({ userId }: Props) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [input, setInput] = useState('')

  const todayKey = () => {
    const d = new Date()
    return (
      STORAGE_KEY_PREFIX +
      userId +
      '_' +
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    )
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(todayKey())
      if (raw) setTodos(JSON.parse(raw) as Todo[])
    } catch {
      // 무시
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = (items: Todo[]) => {
    setTodos(items)
    try {
      localStorage.setItem(todayKey(), JSON.stringify(items))
    } catch {
      // 무시
    }
  }

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    save([
      ...todos,
      { id: crypto.randomUUID(), text: input.trim(), done: false },
    ])
    setInput('')
  }

  const toggleTodo = (id: string) => {
    save(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  const deleteTodo = (id: string) => {
    save(todos.filter((t) => t.id !== id))
  }

  const doneCount = todos.filter((t) => t.done).length

  return (
    <div className="space-y-3">
      {/* 진행률 */}
      {todos.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent-green transition-all duration-300"
              style={{ width: `${(doneCount / todos.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-gray-500">
            {doneCount}/{todos.length}
          </span>
        </div>
      )}

      {/* Todo 리스트 */}
      <div className="space-y-1.5">
        {todos.length === 0 && (
          <p className="py-3 text-center text-sm text-gray-400">
            오늘의 할 일을 추가해 보세요
          </p>
        )}
        {todos.map((todo) => (
          <div
            key={todo.id}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
              todo.done
                ? 'border-gray-100 bg-gray-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <button
              type="button"
              onClick={() => toggleTodo(todo.id)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                todo.done
                  ? 'border-accent-green bg-accent-green'
                  : 'border-gray-300 hover:border-primary-700'
              }`}
            >
              {todo.done && <Check size={11} className="text-white" strokeWidth={3} />}
            </button>
            <span
              className={`flex-1 text-sm ${
                todo.done ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}
            >
              {todo.text}
            </span>
            <button
              type="button"
              onClick={() => deleteTodo(todo.id)}
              className="shrink-0 rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* 입력 폼 */}
      <form onSubmit={addTodo} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="할 일 입력..."
          className="h-10 flex-1"
        />
        <Button
          type="submit"
          size="sm"
          className="h-10 w-10 shrink-0 bg-primary-700 p-0 text-white hover:bg-primary-800"
          disabled={!input.trim()}
        >
          <Plus size={16} />
        </Button>
      </form>
    </div>
  )
}
