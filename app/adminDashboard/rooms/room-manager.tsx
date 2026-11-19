'use client'

import { useState, type FormEvent } from 'react'
import { formatRoomUsageType, type RoomUsageType } from '@/lib/rooms'

type RoomOption = {
  id: string
  name: string
  type: RoomUsageType
}

const roomUsageOptions: Array<{ value: RoomUsageType; label: string }> = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'lab', label: 'Lab' },
  { value: 'both', label: 'Both' },
]

export default function RoomManager({ initialRooms }: { initialRooms: RoomOption[] }) {
  const [rooms, setRooms] = useState(initialRooms)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomType, setNewRoomType] = useState<RoomUsageType>('lecture')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [updatingRoomId, setUpdatingRoomId] = useState('')
  const [removingRoomId, setRemovingRoomId] = useState('')

  async function addRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName, type: newRoomType }),
      })
      const result = (await response.json()) as { data?: RoomOption; message?: string }
      if (!response.ok) throw new Error(result.message || 'The room could not be added.')
      if (!result.data) throw new Error('The server did not return the saved room.')

      setRooms((current) => [...current, result.data!].sort((a, b) => a.name.localeCompare(b.name)))
      setNewRoomName('')
      setNotice(
        `${result.data.name} (${formatRoomUsageType(result.data.type)}) added to the allowed rooms.`,
      )
    } catch (roomError) {
      setError(roomError instanceof Error ? roomError.message : 'The room could not be added.')
    } finally {
      setIsSaving(false)
    }
  }

  async function updateRoomType(room: RoomOption, nextType: RoomUsageType) {
    if (room.type === nextType) return
    setError('')
    setNotice('')
    setUpdatingRoomId(room.id)

    try {
      const response = await fetch(`/api/rooms?id=${encodeURIComponent(room.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: nextType }),
      })
      const result = (await response.json()) as { data?: RoomOption; message?: string }
      if (!response.ok) throw new Error(result.message || 'The room type could not be updated.')
      if (!result.data) throw new Error('The server did not return the updated room.')

      setRooms((current) =>
        current.map((entry) => (entry.id === room.id ? result.data! : entry)),
      )
      setNotice(result.message || `${room.name} updated to ${formatRoomUsageType(nextType)}.`)
    } catch (roomError) {
      setError(roomError instanceof Error ? roomError.message : 'The room type could not be updated.')
    } finally {
      setUpdatingRoomId('')
    }
  }

  async function removeRoom(room: RoomOption) {
    setError('')
    setNotice('')
    setRemovingRoomId(room.id)

    try {
      const response = await fetch(`/api/rooms?id=${encodeURIComponent(room.id)}`, {
        method: 'DELETE',
      })
      const result = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(result.message || 'The room could not be removed.')

      setRooms((current) => current.filter((entry) => entry.id !== room.id))
      setNotice(`${room.name} removed from the allowed rooms.`)
    } catch (roomError) {
      setError(roomError instanceof Error ? roomError.message : 'The room could not be removed.')
    } finally {
      setRemovingRoomId('')
    }
  }

  return (
    <section
      aria-labelledby="room-inventory-title"
      className="rounded-lg bg-white p-4 shadow-[0_2px_5px_rgba(31,41,55,0.16)] sm:p-5"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 id="room-inventory-title" className="text-sm font-semibold text-[#5d1a25]">
            Allowed rooms
          </h2>
          <p className="mt-1 text-[11px] text-[#8b777b]">
            Choose whether each room is allowed for Lecture, Lab, or Both when scheduling classes.
          </p>
        </div>

        <form
          onSubmit={addRoom}
          className="grid w-full gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end xl:max-w-2xl"
        >
          <label
            htmlFor="new-room-name"
            className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[#705c60]"
          >
            Room name
            <input
              id="new-room-name"
              required
              maxLength={60}
              value={newRoomName}
              onChange={(event) => setNewRoomName(event.target.value)}
              disabled={isSaving}
              className="min-w-0 flex-1 rounded-md border border-[#d9c9cc] px-3 py-2 text-xs text-[#383236]"
              placeholder="e.g. Science Building 201"
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[#705c60]">Allowed for</span>
            <div
              role="group"
              aria-label="Room allowed class types"
              className="inline-flex rounded-md border border-[#d9c9cc] bg-[#faf7f7] p-0.5"
            >
              {roomUsageOptions.map((option) => {
                const isSelected = newRoomType === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={isSaving}
                    onClick={() => setNewRoomType(option.value)}
                    className={`rounded px-2.5 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-[#5d1a25] text-white shadow-sm'
                        : 'text-[#6e5e62] hover:bg-white hover:text-[#5d1a25]'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={!newRoomName.trim() || isSaving}
            className="h-[34px] rounded-md bg-[#5d1a25] px-3.5 text-xs font-semibold text-white hover:bg-[#43121a] disabled:opacity-50"
          >
            {isSaving ? 'Adding…' : 'Add room'}
          </button>
        </form>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-xs text-green-800">
          {notice}
        </p>
      )}

      {rooms.length ? (
        <ul className="mt-4 divide-y divide-[#eee6e7]">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-[#383236]">{room.name}</span>
                <span className="rounded-full bg-[#f7ecee] px-2.5 py-0.5 text-[10px] font-semibold text-[#5d1a25]">
                  {formatRoomUsageType(room.type)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label={`Allowed class types for ${room.name}`}
                  className="inline-flex rounded-md border border-[#eadde0] bg-[#faf7f7] p-0.5"
                >
                  {roomUsageOptions.map((option) => {
                    const isSelected = room.type === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isSelected}
                        disabled={updatingRoomId === room.id || removingRoomId === room.id}
                        onClick={() => void updateRoomType(room, option.value)}
                        className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
                          isSelected
                            ? 'bg-[#5d1a25] text-white shadow-sm'
                            : 'text-[#6e5e62] hover:bg-white hover:text-[#5d1a25]'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => void removeRoom(room)}
                  disabled={!!removingRoomId || updatingRoomId === room.id}
                  aria-label={`Remove ${room.name}`}
                  className="rounded-md border border-[#eadde0] px-3 py-1.5 text-xs font-medium text-[#a52832] hover:bg-[#fbf7f8] disabled:opacity-50"
                >
                  {removingRoomId === room.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-md bg-[#faf7f7] px-3 py-4 text-center text-xs text-[#8b777b]">
          No rooms are allowed yet. Add a room above before generating a schedule.
        </p>
      )}
    </section>
  )
}
