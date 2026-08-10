import { useState } from 'react'
import { GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { platformLogo } from '@/lib/utils'
import {
  PLATFORM_LABELS,
  STRATEGY_FIELDS,
  moveStrategyPlatform,
  type OutreachStrategy,
  type PlatformStrategy,
} from '@/lib/users'
import type { Platform } from '@/types'
import { cn } from '@/lib/utils'

interface StrategyBuilderProps {
  value: OutreachStrategy
  onChange: (next: OutreachStrategy) => void
}

export function StrategyBuilder({ value, onChange }: StrategyBuilderProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const updatePlatform = (index: number, patch: Partial<PlatformStrategy>) => {
    const platforms = value.platforms.map((p, i) => (i === index ? { ...p, ...patch } : p))
    onChange({ platforms })
  }

  const setTarget = (index: number, key: string, raw: number) => {
    const platform = value.platforms[index]
    updatePlatform(index, {
      targets: { ...platform.targets, [key]: Math.max(0, raw) },
    })
  }

  const onDrop = (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    onChange(moveStrategyPlatform(value, dragIndex, toIndex))
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Drag platforms to set outreach order. Toggle platforms on/off and set daily targets for each.
      </p>
      <div className="space-y-2">
        {value.platforms.map((platform, index) => {
          const fields = STRATEGY_FIELDS[platform.id] ?? []
          const logo = platformLogo(platform.id)
          return (
            <div
              key={platform.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setOverIndex(index)
              }}
              onDrop={(e) => {
                e.preventDefault()
                onDrop(index)
              }}
              className={cn(
                'rounded-xl border border-border bg-card p-3 transition-all',
                !platform.enabled && 'opacity-55',
                overIndex === index && dragIndex !== null && dragIndex !== index && 'ring-2 ring-primary/40',
                dragIndex === index && 'opacity-70'
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
                  aria-label={`Drag ${PLATFORM_LABELS[platform.id]}`}
                  tabIndex={-1}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {logo ? (
                      <img src={logo} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{PLATFORM_LABELS[platform.id as Platform]}</p>
                      <p className="text-xs text-muted-foreground">Step {index + 1}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Enabled</Label>
                      <Switch
                        checked={platform.enabled}
                        onCheckedChange={(checked) => updatePlatform(index, { enabled: checked })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Minutes</Label>
                      <Input
                        type="number"
                        min={5}
                        value={platform.estimatedMinutes}
                        disabled={!platform.enabled}
                        onChange={(e) =>
                          updatePlatform(index, {
                            estimatedMinutes: Math.max(5, Number(e.target.value) || 5),
                          })
                        }
                      />
                    </div>
                    {fields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs">{field.label}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={platform.targets[field.key] ?? field.defaultValue}
                          disabled={!platform.enabled}
                          onChange={(e) => setTarget(index, field.key, Number(e.target.value) || 0)}
                        />
                      </div>
                    ))}
                    {fields.length === 0 && (
                      <p className="col-span-2 sm:col-span-3 text-xs text-muted-foreground self-end pb-2">
                        Checklist-only platform (no numeric targets).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChange({
              platforms: value.platforms.map((p) => ({ ...p, enabled: true })),
            })
          }}
        >
          Enable all
        </Button>
      </div>
    </div>
  )
}
