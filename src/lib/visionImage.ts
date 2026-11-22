/**
 * 儿童看图问答的本地图片压缩与角色专属视觉引导。
 */

const ALLOWED_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export async function compressImageFileToDataUrl(
  file: Blob,
  maxSide = 1280,
  quality = 0.85,
): Promise<string> {
  if (file.type && !ALLOWED_IMAGE_MIME.has(file.type.toLowerCase())) {
    throw new Error('请选择 PNG、JPG 或 WebP 格式的图片哦');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('这张图片太大啦，请选一张小一点的照片吧');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('没能打开这张图片，换一张试试吧'));
      el.src = objectUrl;
    });

    const w = img.naturalWidth || img.width || 1;
    const h = img.naturalHeight || img.height || 1;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器画布初始化失败');

    // 白底填充避免透明 PNG 转 JPEG 变黑
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function buildVisionHintForCompanion(companionId: string): string {
  switch (companionId) {
    case 'kid-math-bear':
      return '孩子发来了一张图片。如果图里是算术题、数数或图形问题，请先表扬孩子愿意动脑，再引导观察图里的已知条件、一步一步启发思路，不要直接丢出最终答案；如果是普通日常物品，就带着数一数、比一比大小或形状。';
    case 'kid-curious-doctor':
      return '孩子发来了一张图片（可能是自然景物、动植物、玩具或生活现象）。请用 5 到 10 岁孩子听得懂的语言先说出图里有什么，再分享 1 个有趣好记的科学或自然小知识。';
    case 'kid-story-fairy':
      return '孩子发来了一张图片（可能是手绘画、照片或物品）。请结合图片里最有趣的小细节，为孩子即兴编一小段温暖可爱的童话开头，并在最后轻声问一句“你猜接下来发生什么呀？”。';
    case 'kid-drawing-bunny':
      return '孩子发来了一张作品照片。请先具体夸奖画面里的颜色搭配、线条或想象力亮点，再给出 1 个简单好玩、小朋友马上就能动手添上去的小点子。';
    default:
      return '孩子发来了一张图片。请先认真看懂图片里的内容，用温暖、适龄的语气和孩子互动交流。';
  }
}
