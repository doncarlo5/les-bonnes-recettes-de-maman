"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFieldArray, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { ChevronRight, ListPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Field, FieldLabel, FieldSet, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SortableCollection, SortableEditorRow } from "./admin-sortable-collection";

type RecipeControl = Control<any>;
type RecipeRegister = UseFormRegister<any>;
const blankIngredient = { name: "", quantity: "", unit: "", notes: "" };

export function CompactIngredientsEditor({ name, control, register }: { name: string; control: RecipeControl; register: RecipeRegister }) {
  const { append, fields, move, remove } = useFieldArray({ control, name });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const values = useWatch({ control, name }) ?? [];
  useDeepLinkedIndex(name, fields.length, setEditingIndex);
  const closeEditor = useFocusRestoringClose(editingIndex, fields, setEditingIndex);

  return <FieldSet><CollectionHeader title="Ingrédients" label="Ajouter un ingrédient" onAdd={() => { append({ ...blankIngredient }); setEditingIndex(fields.length); }} />
    <SortableCollection ids={fields.map((field) => field.id)} label="Réordonner les ingrédients" getLabel={(index) => values[index]?.name || `Ingrédient ${index + 1}`} onMove={move} renderItem={(id, index) => {
      const ingredient = values[index] ?? blankIngredient;
      const summary = [ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(" ");
      return <SortableEditorRow key={id} id={id} handleLabel={`Déplacer ${summary || `l’ingrédient ${index + 1}`}`} onOpen={() => setEditingIndex(index)}><span className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1"><span className="block truncate font-black">{summary || `Ingrédient ${index + 1}`}</span>{ingredient.notes ? <span className="block truncate text-xs font-semibold text-muted-foreground">{ingredient.notes}</span> : null}</span><ChevronRight className="size-5 shrink-0 text-muted-foreground" /></span></SortableEditorRow>;
    }} />
    <Drawer open={editingIndex !== null} onOpenChange={(open: boolean) => !open && closeEditor()}><DrawerContent className="max-h-[92dvh] rounded-t-3xl">{editingIndex !== null ? <><DrawerHeader className="text-left"><DrawerTitle className="font-heading text-2xl font-black">Ingrédient {editingIndex + 1}</DrawerTitle><DrawerDescription className="">Renseigne seulement les détails utiles à la recette.</DrawerDescription></DrawerHeader><div className="grid gap-3 overflow-y-auto px-4 pb-4"><Field><FieldLabel>Nom</FieldLabel><Input className="h-11" autoFocus {...register(`${name}.${editingIndex}.name`)} /></Field><div className="grid grid-cols-2 gap-3"><Field><FieldLabel>Quantité</FieldLabel><Input className="h-11" {...register(`${name}.${editingIndex}.quantity`)} /></Field><Field><FieldLabel>Unité</FieldLabel><Input className="h-11" {...register(`${name}.${editingIndex}.unit`)} /></Field></div><Field><FieldLabel>Notes</FieldLabel><Input className="h-11" {...register(`${name}.${editingIndex}.notes`)} /></Field></div><DrawerFooter className=""><Button type="button" variant="destructive" className="min-h-11" onClick={() => { if (window.confirm("Supprimer cet ingrédient ?")) { remove(editingIndex); setEditingIndex(null); } }}><Trash2 /> Supprimer cet ingrédient</Button><Button type="button" className="min-h-12 rounded-xl" onClick={closeEditor}>Terminé</Button></DrawerFooter></> : null}</DrawerContent></Drawer>
  </FieldSet>;
}

export function CompactSectionsEditor({ name, control, register }: { name: string; control: RecipeControl; register: RecipeRegister }) {
  const { append, fields, move, remove } = useFieldArray({ control, name });
  const values = useWatch({ control, name }) ?? [];
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  useDeepLinkedIndex(name, fields.length, setEditingIndex);
  const closeEditor = useFocusRestoringClose(editingIndex, fields, setEditingIndex);

  return <FieldSet><CollectionHeader title="Sections" label="Ajouter une section" onAdd={() => { append({ title: "", steps: [""] }); setEditingIndex(fields.length); }} />
    <SortableCollection ids={fields.map((field) => field.id)} label="Réordonner les sections" getLabel={(index) => values[index]?.title || `Section ${index + 1}`} onMove={move} renderItem={(id, index) => { const section = values[index] ?? { title: "", steps: [] }; return <SortableEditorRow key={id} id={id} handleLabel={`Déplacer ${section.title || `la section ${index + 1}`}`} onOpen={() => setEditingIndex(index)}><span className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1"><span className="block truncate font-black">{section.title || `Section ${index + 1}`}</span><span className="block text-xs font-semibold text-muted-foreground">{section.steps?.filter((step: string) => step.trim()).length ?? 0} étapes</span></span><ChevronRight className="size-5 shrink-0 text-muted-foreground" /></span></SortableEditorRow>; }} />
    <Drawer open={editingIndex !== null} onOpenChange={(open: boolean) => !open && closeEditor()}><DrawerContent className="max-h-[92dvh] rounded-t-3xl">{editingIndex !== null ? <><DrawerHeader className="text-left"><DrawerTitle className="font-heading text-2xl font-black">Section {editingIndex + 1}</DrawerTitle><DrawerDescription className="">Organise les étapes dans leur ordre de préparation.</DrawerDescription></DrawerHeader><div className="grid gap-4 overflow-y-auto px-4 pb-4"><Field><FieldLabel>Titre de section</FieldLabel><Input className="h-11" autoFocus {...register(`${name}.${editingIndex}.title`)} /></Field><CompactStepsEditor name={`${name}.${editingIndex}.steps`} control={control} register={register} /></div><DrawerFooter className=""><Button type="button" variant="destructive" className="min-h-11" onClick={() => { if (window.confirm("Supprimer cette section ?")) { remove(editingIndex); setEditingIndex(null); } }}><Trash2 /> Supprimer la section</Button><Button type="button" className="min-h-12 rounded-xl" onClick={closeEditor}>Terminé</Button></DrawerFooter></> : null}</DrawerContent></Drawer>
  </FieldSet>;
}

function CompactStepsEditor({ name, control, register }: { name: string; control: RecipeControl; register: RecipeRegister }) {
  const { append, fields, move, remove } = useFieldArray({ control, name });
  const values = useWatch({ control, name }) ?? [];
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  useDeepLinkedIndex(name, fields.length, setEditingIndex);
  return <div className="grid gap-2"><div className="flex items-center justify-between gap-3"><FieldTitle>Étapes</FieldTitle><Button type="button" variant="outline" className="min-h-11" onClick={() => { append(""); setEditingIndex(fields.length); }}><ListPlus /> Ajouter</Button></div><SortableCollection ids={fields.map((field) => field.id)} label="Réordonner les étapes" getLabel={(index) => `Étape ${index + 1}`} onMove={move} renderItem={(id, index) => <SortableEditorRow key={id} id={id} handleLabel={`Déplacer l’étape ${index + 1}`} onOpen={() => setEditingIndex(index)}><span className="flex min-w-0 items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-sm font-black tabular-nums">{index + 1}</span><span className="line-clamp-2 flex-1 text-sm font-semibold">{values[index] || `Étape ${index + 1}`}</span><ChevronRight className="size-5 shrink-0 text-muted-foreground" /></span></SortableEditorRow>} />{editingIndex !== null ? <div className="grid gap-2 rounded-xl bg-card p-3 shadow-[var(--shadow-card)]"><Textarea autoFocus placeholder={`Étape ${editingIndex + 1}`} {...register(`${name}.${editingIndex}`)} /><Button type="button" variant="destructive" className="min-h-11" onClick={() => { if (window.confirm("Supprimer cette étape ?")) { remove(editingIndex); setEditingIndex(null); } }}><Trash2 /> Supprimer cette étape</Button><Button type="button" className="min-h-11" onClick={() => setEditingIndex(null)}>Terminé</Button></div> : null}</div>;
}

function CollectionHeader({ title, label, onAdd }: { title: string; label: string; onAdd: () => void }) {
  return <div className="flex items-center justify-between gap-3"><FieldTitle>{title}</FieldTitle><Button type="button" variant="outline" className="min-h-11" onClick={onAdd}><ListPlus /> {label}</Button></div>;
}

function useDeepLinkedIndex(name: string, length: number, setEditingIndex: (index: number) => void) {
  const requestedField = useSearchParams().get("field");
  useEffect(() => { if (!requestedField?.startsWith(`${name}.`)) return; const index = Number(requestedField.slice(name.length + 1).split(".")[0]); if (Number.isInteger(index) && index >= 0 && index < length) setEditingIndex(index); }, [length, name, requestedField, setEditingIndex]);
}

function useFocusRestoringClose(editingIndex: number | null, fields: Array<{ id: string }>, setEditingIndex: (index: number | null) => void) {
  return () => { const id = editingIndex === null ? null : fields[editingIndex]?.id; setEditingIndex(null); if (id) window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-sortable-open="${CSS.escape(id)}"]`)?.focus()); };
}
