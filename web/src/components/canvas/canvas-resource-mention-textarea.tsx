import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent, TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { FileText, Image as ImageIcon, Music2, Video } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { isImeComposing, isPlainEnterKey } from "@/lib/keyboard-event";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";

type MentionState = {
    start: number;
    query: string;
};
const mentionSpacing = "\u00a0\u00a0";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
    value: string;
    references: CanvasResourceReference[];
    onChange: (value: string) => void;
    onSubmit?: () => void;
    containerClassName?: string;
    highlightLabels?: boolean;
};

export const CanvasResourceMentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function CanvasResourceMentionTextarea({ value, references, onChange, onSubmit, onKeyDown, className, containerClassName, style, highlightLabels = true, ...props }, forwardedRef) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const [mention, setMention] = useState<MentionState | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const candidates = useMemo(() => {
        if (!mention) return [];
        const query = mention.query.trim().toLowerCase();
        const activeReferences = references.filter((item) => item.active);
        if (!query) return activeReferences;
        return activeReferences.filter((item) => `${item.label} ${item.title} ${item.kind} ${item.text || ""}`.toLowerCase().includes(query));
    }, [mention, references]);
    const activeLabels = useMemo(() => (highlightLabels ? Array.from(new Set(references.filter((item) => item.active).map((item) => item.label))).sort((a, b) => b.length - a.length) : []), [highlightLabels, references]);

    useEffect(() => {
        const next = normalizeMentionSpacing(value, activeLabels);
        if (next !== value) onChange(next);
    }, [activeLabels, onChange, value]);

    const updateValue = (next: string, selectionStart?: number) => {
        onChange(next);
        if (typeof selectionStart !== "number") return;
        requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(selectionStart, selectionStart);
        });
    };

    const closeMention = () => {
        setMention(null);
        setActiveIndex(0);
    };

    const syncMention = (nextValue: string, cursor: number) => {
        const prefix = nextValue.slice(0, cursor);
        const match = /@([^\s@]*)$/.exec(prefix);
        if (!match || !references.some((item) => item.active)) {
            closeMention();
            return;
        }
        setMention({ start: cursor - match[1].length - 1, query: match[1] });
        setActiveIndex(0);
    };

    const insertReference = (reference: CanvasResourceReference) => {
        if (!mention) return;
        const textarea = textareaRef.current;
        const end = textarea?.selectionStart ?? value.length;
        const insertText = `${reference.label}${mentionSpacing}`;
        const next = `${value.slice(0, mention.start)}${insertText}${value.slice(end)}`;
        closeMention();
        updateValue(next, mention.start + insertText.length);
    };

    const mentionTokenBeforeCursor = (cursor: number) => activeLabels.find((label) => new RegExp(`${escapeRegExp(label)}\\s{0,${mentionSpacing.length}}$`).test(value.slice(0, cursor)));
    const mentionTokenAfterCursor = (cursor: number) => activeLabels.find((label) => new RegExp(`^${escapeRegExp(label)}\\s{0,${mentionSpacing.length}}`).test(value.slice(cursor)));

    const syncOverlayScroll = () => {
        if (!overlayRef.current || !textareaRef.current) return;
        overlayRef.current.scrollTop = textareaRef.current.scrollTop;
        overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    };

    const showOverlay = Boolean(activeLabels.length && activeLabels.some((label) => value.includes(label)));
    const mergedStyle = {
        ...(style || {}),
        color: showOverlay ? "transparent" : style?.color,
        caretColor: style?.color || theme.node.text,
        position: "relative",
        zIndex: 1,
        ...(showOverlay ? { background: "transparent", backgroundColor: "transparent" } : {}),
    } as CSSProperties;
    const menu = mention && candidates.length && textareaRef.current ? <MentionMenu textarea={textareaRef.current} references={candidates} activeIndex={Math.min(activeIndex, candidates.length - 1)} theme={theme} onSelect={insertReference} /> : null;

    return (
        <div className={`relative h-full w-full ${containerClassName || ""}`}>
            {showOverlay ? (
                <div ref={overlayRef} className={`${className || ""} pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre-wrap break-words`} style={{ ...style, color: theme.node.text, background: "transparent", backgroundColor: "transparent" }}>
                    <MentionHighlightText value={value || props.placeholder?.toString() || ""} labels={activeLabels} placeholder={!value} theme={theme} />
                </div>
            ) : null}
            <textarea
                {...props}
                ref={(node) => {
                    textareaRef.current = node;
                    if (typeof forwardedRef === "function") forwardedRef(node);
                    else if (forwardedRef) forwardedRef.current = node;
                }}
                value={value}
                className={className}
                style={mergedStyle}
                onChange={(event) => {
                    const next = event.target.value;
                    onChange(next);
                    syncMention(next, event.target.selectionStart);
                    requestAnimationFrame(syncOverlayScroll);
                }}
                onSelect={(event) => {
                    props.onSelect?.(event);
                }}
                onKeyUp={(event) => {
                    props.onKeyUp?.(event);
                }}
                onPointerUp={(event) => {
                    props.onPointerUp?.(event);
                }}
                onKeyDown={(event) => {
                    if (isImeComposing(event)) {
                        onKeyDown?.(event);
                        return;
                    }
                    if (mention && candidates.length) {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setActiveIndex((index) => (index + 1) % candidates.length);
                            return;
                        }
                        if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setActiveIndex((index) => (index - 1 + candidates.length) % candidates.length);
                            return;
                        }
                        if (event.key === "Enter") {
                            event.preventDefault();
                            insertReference(candidates[Math.min(activeIndex, candidates.length - 1)]);
                            return;
                        }
                        if (event.key === "Escape") {
                            event.preventDefault();
                            closeMention();
                            return;
                        }
                    }
                    if (event.currentTarget.selectionStart === event.currentTarget.selectionEnd) {
                        const cursor = event.currentTarget.selectionStart;
                        const before = event.key === "Backspace" ? mentionTokenBeforeCursor(cursor) : null;
                        const after = event.key === "Delete" ? mentionTokenAfterCursor(cursor) : null;
                        const token = before || after;
                        if (token) {
                            event.preventDefault();
                            const start = before ? cursor - token.length - Math.min(mentionSpacing.length, value.slice(0, cursor).match(/\s*$/)?.[0].length || 0) : cursor;
                            const end = after ? cursor + token.length + Math.min(mentionSpacing.length, value.slice(cursor + token.length).match(/^\s*/)?.[0].length || 0) : cursor;
                            updateValue(`${value.slice(0, start)}${value.slice(end)}`, start);
                            return;
                        }
                    }
                    if (isPlainEnterKey(event) && onSubmit) {
                        event.preventDefault();
                        onSubmit();
                        return;
                    }
                    onKeyDown?.(event);
                }}
                onScroll={(event) => {
                    syncOverlayScroll();
                    props.onScroll?.(event);
                }}
                onBlur={(event) => {
                    window.setTimeout(closeMention, 120);
                    props.onBlur?.(event);
                }}
            />
            {menu}
        </div>
    );
});

type EditorProps = Pick<Props, "value" | "references" | "onChange" | "onSubmit" | "className" | "style" | "placeholder">;

export function CanvasResourceMentionEditor({ value, references, onChange, onSubmit, className, style, placeholder }: EditorProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const editorRef = useRef<HTMLDivElement>(null);
    const lastValueRef = useRef("");
    const lastLabelsRef = useRef("");
    const isComposingRef = useRef(false);
    const compositionRef = useRef<{ value: string; start: number; end: number } | null>(null);
    const pendingInputRef = useRef<{ value: string; start: number; end: number } | null>(null);
    const inputFrameRef = useRef<number | null>(null);
    const [mention, setMention] = useState<MentionState | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeLabels = useMemo(() => Array.from(new Set(references.filter((item) => item.active).map((item) => item.label))).sort((a, b) => b.length - a.length), [references]);
    const candidates = useMemo(() => {
        if (!mention) return [];
        const query = mention.query.trim().toLowerCase();
        const activeReferences = references.filter((item) => item.active);
        return query ? activeReferences.filter((item) => `${item.label} ${item.title} ${item.kind} ${item.text || ""}`.toLowerCase().includes(query)) : activeReferences;
    }, [mention, references]);
    const labelsKey = activeLabels.join("\u0000");

    useEffect(
        () => () => {
            if (inputFrameRef.current) cancelAnimationFrame(inputFrameRef.current);
        },
        [],
    );

    useLayoutEffect(() => {
        const editor = editorRef.current;
        if (!editor || (lastValueRef.current === value && editorValue(editor) === value && lastLabelsRef.current === labelsKey)) return;
        renderEditorValue(editor, value, activeLabels, theme);
        lastValueRef.current = value;
        lastLabelsRef.current = labelsKey;
    }, [activeLabels, labelsKey, theme, value]);

    const closeMention = () => {
        setMention(null);
        setActiveIndex(0);
    };

    const syncMention = (nextValue: string, cursor: number) => {
        const match = /@([^\s@]*)$/.exec(nextValue.slice(0, cursor));
        if (!match || !activeLabels.length) return closeMention();
        setMention({ start: cursor - match[1].length - 1, query: match[1] });
        setActiveIndex(0);
    };

    const updateValue = (next: string, cursor: number) => {
        const editor = editorRef.current;
        if (!editor) return;
        renderEditorValue(editor, next, activeLabels, theme);
        lastValueRef.current = next;
        lastLabelsRef.current = labelsKey;
        onChange(next);
        requestAnimationFrame(() => setEditorCaretOffset(editor, cursor));
    };

    const replaceSelection = (text: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        const { start, end } = editorSelectionOffsets(editor);
        updateValue(`${value.slice(0, start)}${text}${value.slice(end)}`, start + text.length);
    };

    const startComposition = () => {
        if (compositionRef.current) return;
        const editor = editorRef.current;
        if (inputFrameRef.current) cancelAnimationFrame(inputFrameRef.current);
        inputFrameRef.current = null;
        if (pendingInputRef.current) {
            compositionRef.current = pendingInputRef.current;
            pendingInputRef.current = null;
            return;
        }
        if (editor) compositionRef.current = { value: editorValue(editor), ...editorSelectionOffsets(editor) };
    };

    const commitEditorValue = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const next = editorValue(editor);
        lastValueRef.current = next;
        onChange(next);
        syncMention(next, editorCaretOffset(editor));
    };

    const insertReference = (reference: CanvasResourceReference) => {
        if (!mention) return;
        const editor = editorRef.current;
        if (!editor) return;
        const end = editorCaretOffset(editor);
        const next = `${value.slice(0, mention.start)}${reference.label}${value.slice(end)}`;
        closeMention();
        updateValue(next, mention.start + reference.label.length);
    };

    const menu = mention && candidates.length && editorRef.current ? <MentionMenu textarea={editorRef.current} references={candidates} activeIndex={Math.min(activeIndex, candidates.length - 1)} theme={theme} onSelect={insertReference} /> : null;

    return (
        <div className="relative h-full w-full">
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                data-placeholder={placeholder}
                className={`${className || ""} overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:opacity-45`}
                style={style}
                onBeforeInput={(event) => {
                    const inputType = (event.nativeEvent as InputEvent).inputType;
                    if (inputType === "insertCompositionText") {
                        startComposition();
                        return;
                    }
                    const editor = editorRef.current;
                    if (editor && !isComposingRef.current) pendingInputRef.current = { value, ...editorSelectionOffsets(editor) };
                }}
                onInput={(event) => {
                    if (isComposingRef.current || (event.nativeEvent as InputEvent).isComposing) return;
                    if (inputFrameRef.current) cancelAnimationFrame(inputFrameRef.current);
                    inputFrameRef.current = requestAnimationFrame(() => {
                        inputFrameRef.current = null;
                        if (!isComposingRef.current) {
                            pendingInputRef.current = null;
                            commitEditorValue();
                        }
                    });
                }}
                onCompositionStart={() => {
                    isComposingRef.current = true;
                    startComposition();
                }}
                onCompositionEnd={(event) => {
                    isComposingRef.current = false;
                    const composition = compositionRef.current;
                    compositionRef.current = null;
                    pendingInputRef.current = null;
                    if (!composition) return commitEditorValue();
                    const text = event.data || "";
                    updateValue(`${composition.value.slice(0, composition.start)}${text}${composition.value.slice(composition.end)}`, composition.start + text.length);
                }}
                onKeyDown={(event) => {
                    if (isImeComposing(event)) return;
                    if (mention && candidates.length) {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setActiveIndex((index) => (index + 1) % candidates.length);
                            return;
                        }
                        if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setActiveIndex((index) => (index - 1 + candidates.length) % candidates.length);
                            return;
                        }
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            insertReference(candidates[Math.min(activeIndex, candidates.length - 1)]);
                            return;
                        }
                        if (event.key === "Escape") {
                            event.preventDefault();
                            closeMention();
                            return;
                        }
                    }
                    if (event.key === "Enter" && event.shiftKey) {
                        event.preventDefault();
                        replaceSelection("\n");
                        return;
                    }
                    const editor = editorRef.current;
                    if (editor && (event.key === "Backspace" || event.key === "Delete")) {
                        const token = editorMentionAtOffset(editor, editorCaretOffset(editor), event.key === "Backspace" ? "before" : "after");
                        if (token) {
                            event.preventDefault();
                            updateValue(`${value.slice(0, token.start)}${value.slice(token.end)}`, token.start);
                            return;
                        }
                    }
                    if (isPlainEnterKey(event) && onSubmit) {
                        event.preventDefault();
                        onSubmit();
                    }
                }}
                onPaste={(event) => {
                    event.preventDefault();
                    replaceSelection(event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n"));
                }}
                onBlur={() => window.setTimeout(closeMention, 120)}
            />
            {menu}
        </div>
    );
}

function MentionHighlightText({ value, labels, placeholder, theme }: { value: string; labels: string[]; placeholder: boolean; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    if (placeholder) return <span className="opacity-45">{value}</span>;
    if (!labels.length) return <>{value}</>;
    const pattern = new RegExp(`(${labels.map(escapeRegExp).join("|")})`, "g");
    return (
        <>
            {value.split(pattern).map((part, index) =>
                labels.includes(part) ? (
                    <span key={`${part}-${index}`} className="rounded text-[#2f80ff]" style={{ background: "rgba(47, 128, 255, .16)", boxShadow: "0 0 0 4px rgba(47, 128, 255, .18)" }}>
                        {part}
                    </span>
                ) : (
                    <span key={`${part}-${index}`}>{part}</span>
                ),
            )}
        </>
    );
}

function renderEditorValue(editor: HTMLDivElement, value: string, labels: string[], theme: (typeof canvasThemes)[keyof typeof canvasThemes]) {
    const fragment = document.createDocumentFragment();
    const pattern = labels.length ? new RegExp(`(${labels.map(escapeRegExp).join("|")})`, "g") : null;
    (pattern ? value.split(pattern) : [value]).forEach((part) => {
        if (labels.includes(part)) {
            const token = document.createElement("span");
            token.dataset.mention = "true";
            token.contentEditable = "false";
            token.className = "mx-1 inline-flex rounded-md border px-1.5 py-0.5 align-baseline text-[0.9em] leading-none";
            token.style.background = "rgba(47, 128, 255, .16)";
            token.style.borderColor = "rgba(47, 128, 255, .32)";
            token.style.color = "#2f80ff";
            token.textContent = part;
            fragment.append(token);
            return;
        }
        fragment.append(document.createTextNode(part));
    });
    editor.replaceChildren(fragment);
    void theme;
}

function editorValue(editor: HTMLElement) {
    return editor.innerText.replace(/\r/g, "");
}

function editorCaretOffset(editor: HTMLElement) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return editorValue(editor).length;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.endContainer)) return editorValue(editor).length;
    const before = range.cloneRange();
    before.selectNodeContents(editor);
    before.setEnd(range.endContainer, range.endOffset);
    return before.toString().length;
}

function editorSelectionOffsets(editor: HTMLElement) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) {
        const length = editorValue(editor).length;
        return { start: length, end: length };
    }
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
        const length = editorValue(editor).length;
        return { start: length, end: length };
    }
    const offsetAt = (container: Node, offset: number) => {
        const before = range.cloneRange();
        before.selectNodeContents(editor);
        before.setEnd(container, offset);
        return before.toString().length;
    };
    return { start: offsetAt(range.startContainer, range.startOffset), end: offsetAt(range.endContainer, range.endOffset) };
}

function setEditorCaretOffset(editor: HTMLElement, offset: number) {
    const range = document.createRange();
    const selection = window.getSelection();
    let position = 0;
    for (const node of editor.childNodes) {
        const length = (node.textContent || "").length;
        if (offset > position + length) {
            position += length;
            continue;
        }
        if (node instanceof HTMLElement && node.dataset.mention) {
            if (offset === position) range.setStartBefore(node);
            else range.setStartAfter(node);
        } else {
            range.setStart(node, Math.max(0, Math.min(offset - position, length)));
        }
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        editor.focus();
        return;
    }
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus();
}

function editorMentionAtOffset(editor: HTMLElement, offset: number, direction: "before" | "after") {
    let position = 0;
    for (const node of editor.childNodes) {
        const length = (node.textContent || "").length;
        if (node instanceof HTMLElement && node.dataset.mention) {
            if ((direction === "before" && offset === position + length) || (direction === "after" && offset === position)) return { start: position, end: position + length };
        }
        position += length;
    }
    return null;
}

function MentionMenu({ textarea, references, activeIndex, theme, onSelect }: { textarea: HTMLElement; references: CanvasResourceReference[]; activeIndex: number; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onSelect: (reference: CanvasResourceReference) => void }) {
    const selectedRef = useRef(false);
    const rect = textarea.getBoundingClientRect();
    const boundary = textarea.closest(".ant-modal-content")?.getBoundingClientRect() || { left: 8, top: 8, right: window.innerWidth - 8, bottom: window.innerHeight - 8 };
    const menuWidth = 256;
    const maxMenuHeight = 224;
    const gap = 6;
    const left = clamp(rect.left, boundary.left + 8, boundary.right - menuWidth - 8);
    const showAbove = rect.bottom + gap + maxMenuHeight > boundary.bottom && rect.top - gap - maxMenuHeight >= boundary.top;
    const top = clamp(showAbove ? rect.top - gap - maxMenuHeight : rect.bottom + gap, boundary.top + 8, boundary.bottom - maxMenuHeight - 8);

    const stopCanvasInteraction = (event: PointerEvent | MouseEvent) => {
        event.stopPropagation();
    };
    const selectReference = (reference: CanvasResourceReference) => {
        if (selectedRef.current) return;
        selectedRef.current = true;
        onSelect(reference);
    };

    return createPortal(
        <div
            data-canvas-resource-mention-menu="true"
            className="fixed z-[120] max-h-56 w-64 overflow-y-auto rounded-xl border p-1 shadow-2xl backdrop-blur-md"
            style={{ left, top, background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
            onPointerDown={stopCanvasInteraction}
            onMouseDown={stopCanvasInteraction}
            onClick={(event) => event.stopPropagation()}
        >
            {references.map((reference, index) => (
                <button
                    key={reference.id}
                    type="button"
                    className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition"
                    style={{ background: index === activeIndex ? theme.toolbar.activeBg : "transparent", color: index === activeIndex ? theme.toolbar.activeText : theme.node.text }}
                    onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectReference(reference);
                    }}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectReference(reference);
                    }}
                >
                    <ReferencePreview reference={reference} />
                    <span className="min-w-0 flex-1">
                        <span className="block font-medium">{reference.label}</span>
                        <span className="block truncate opacity-65">{reference.text || reference.title}</span>
                    </span>
                </button>
            ))}
        </div>,
        document.body,
    );
}

function ReferencePreview({ reference }: { reference: CanvasResourceReference }) {
    if (reference.kind === "image" && reference.previewUrl) return <img src={reference.previewUrl} alt="" className="size-9 rounded-md object-cover" />;
    if (reference.kind === "video" && reference.previewUrl) return <video src={reference.previewUrl} className="size-9 rounded-md bg-black object-cover" muted preload="metadata" />;
    const Icon = reference.kind === "audio" ? Music2 : reference.kind === "video" ? Video : reference.kind === "image" ? ImageIcon : FileText;
    return (
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-black/10">
            <Icon className="size-4" />
        </span>
    );
}

function clamp(value: number, min: number, max: number) {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
}

function normalizeMentionSpacing(value: string, labels: string[]) {
    return labels.reduce((text, label) => text.replace(new RegExp(`(${escapeRegExp(label)})\\s{1,${mentionSpacing.length + 2}}(?=\\S)`, "g"), `$1${mentionSpacing}`), value);
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
