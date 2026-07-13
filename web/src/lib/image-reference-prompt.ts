import type { ReferenceImage } from "@/types/image";

export function imageReferenceLabel(index: number) {
    return `图片${index + 1}`;
}

export function buildImageReferencePromptText(prompt: string, references: ReferenceImage[]) {
    const text = prompt.trim().replace(/[\u00a0\u2009]/g, " ");
    if (!references.length) return text;
    const labels = references.map((image, index) => `${imageReferenceLabel(index)}（${image.name.replace(/\.[^.]+$/, "") || "未命名参考图"}）`);
    return `参考图片：${labels.join("、")}。请按编号理解提示词中的图片引用，并明确每张图片需要保留、迁移或组合的内容。\n\n${text}`;
}
