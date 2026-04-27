"use client";

import { useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
import { GripVertical, Trash2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImageData = {
  id: string;
  groupNumber: number;
  displayOrder: number;
  publicUrl: string;
};

interface ImageGroupProps {
  images: ImageData[];
  groupNumber: number;
  disabled: boolean;
  onUpload: (file: File) => Promise<{ success: boolean; error?: string }>;
  onDelete: (imageId: string) => Promise<{ success: boolean; error?: string }>;
  onReorder: (orderedIds: string[]) => Promise<{ success: boolean; error?: string }>;
}

function SortableImage({
  image,
  disabled,
  onDelete,
  isDeleting,
}: {
  image: ImageData;
  disabled: boolean;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border bg-bg p-2 mb-2"
    >
      {!disabled && (
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-fg3 hover:text-fg2 flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>
      )}
      <img
        src={image.publicUrl}
        alt=""
        className="h-16 w-24 object-cover rounded flex-shrink-0"
      />
      <div className="flex-1 min-w-0" />
      {!disabled && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-fg3 hover:text-danger flex-shrink-0 p-1"
          title="Delete image"
        >
          {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
      )}
    </div>
  );
}

export default function ImageGroup({
  images,
  groupNumber,
  disabled,
  onUpload,
  onDelete,
  onReorder,
}: ImageGroupProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    const result = await onUpload(file);
    setIsUploading(false);

    if (!result.success) {
      setError(result.error || "Upload failed");
    }

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(imageId: string) {
    setDeletingId(imageId);
    setError(null);
    const result = await onDelete(imageId);
    setDeletingId(null);
    if (!result.success) {
      setError(result.error || "Delete failed");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = images.map((i) => i.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);

    const reordered = [...ids];
    reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, active.id as string);

    onReorder(reordered);
  }

  return (
    <div className="mb-2">
      {images.length === 0 && !disabled && (
        <p className="text-sm text-fg3 italic mb-2">No images yet</p>
      )}

      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {images.map((image) => (
              <SortableImage
                key={image.id}
                image={image}
                disabled={disabled}
                onDelete={() => handleDelete(image.id)}
                isDeleting={deletingId === image.id}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {!disabled && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,.heic"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <><Loader2 size={14} className="animate-spin mr-1.5" /> Uploading&hellip;</>
            ) : (
              <><Plus size={14} className="mr-1.5" /> Add Image</>
            )}
          </Button>
        </>
      )}

      {error && <p className="mt-2 text-sm text-ember-600">{error}</p>}
    </div>
  );
}
