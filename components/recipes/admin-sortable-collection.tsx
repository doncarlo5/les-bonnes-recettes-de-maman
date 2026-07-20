"use client";

import { useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function SortableCollection({ ids, label, getLabel, onMove, renderItem }: { ids: string[]; label: string; getLabel: (index: number) => string; onMove: (from: number, to: number) => void; renderItem: (id: string, index: number) => ReactNode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const activeIndex = activeId ? ids.indexOf(activeId) : -1;

  function finishDrag(event: DragEndEvent) {
    const from = ids.indexOf(String(event.active.id));
    const to = event.over ? ids.indexOf(String(event.over.id)) : from;
    if (from >= 0 && to >= 0 && from !== to) onMove(from, to);
    setAnnouncement(to >= 0 ? `${getLabel(from)} déplacé en position ${to + 1}.` : "Déplacement annulé.");
    setActiveId(null);
  }

  return <DndContext sensors={sensors} collisionDetection={closestCenter} autoScroll onDragStart={({ active }) => { const index = ids.indexOf(String(active.id)); setActiveId(String(active.id)); setAnnouncement(`${getLabel(index)} saisi. Utilise les flèches pour le déplacer.`); }} onDragCancel={() => { setActiveId(null); setAnnouncement("Déplacement annulé."); }} onDragEnd={finishDrag}>
    <SortableContext items={ids} strategy={verticalListSortingStrategy}><div className="grid gap-2" aria-label={label}>{ids.map((id, index) => renderItem(id, index))}</div></SortableContext>
    <DragOverlay dropAnimation={null}>{activeIndex >= 0 ? <div className="rounded-xl bg-card px-4 py-3 font-black shadow-[var(--shadow-card)] outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">{getLabel(activeIndex)}</div> : null}</DragOverlay>
    <p className="sr-only" aria-live="assertive">{announcement}</p>
  </DndContext>;
}

export function SortableEditorRow({ id, handleLabel, onOpen, children }: { id: string; handleLabel: string; onOpen: () => void; children: ReactNode }) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`grid min-h-14 grid-cols-[2.75rem_1fr] items-stretch gap-1 rounded-xl bg-muted/55 p-1 shadow-[var(--shadow-border)] transition-[opacity,box-shadow] ${isDragging ? "opacity-40" : "opacity-100"}`}>
    <button ref={setActivatorNodeRef} type="button" aria-label={handleLabel} className="grid size-11 touch-none place-items-center rounded-lg bg-card transition-[scale,background-color] active:scale-[0.96] focus-visible:ring-3 focus-visible:ring-ring/80" {...attributes} {...listeners}><GripVertical className="size-5 text-muted-foreground" /></button>
    <button type="button" data-sortable-open={id} onClick={onOpen} className="min-h-11 min-w-0 rounded-lg px-2 text-left transition-[scale,background-color] active:scale-[0.96]">{children}</button>
  </div>;
}

export function SortableInlineRow({ id, handleLabel, children }: { id: string; handleLabel: string; children: ReactNode }) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`grid grid-cols-[2.75rem_1fr] items-start gap-2 rounded-lg border p-2 transition-opacity ${isDragging ? "opacity-40" : "opacity-100"}`}>
    <button ref={setActivatorNodeRef} type="button" aria-label={handleLabel} className="grid size-11 touch-none place-items-center rounded-lg bg-muted transition-transform active:scale-[0.96] focus-visible:ring-3 focus-visible:ring-ring/80" {...attributes} {...listeners}><GripVertical className="size-5 text-muted-foreground" /></button>
    <div className="min-w-0">{children}</div>
  </div>;
}
