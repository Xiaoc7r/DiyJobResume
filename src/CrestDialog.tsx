import { useEffect, useRef, useState } from "react";
import { X, Upload, GraduationCap, ArrowUpRight, Search } from "lucide-react";

export function CrestDialog({
  current,
  onClose,
  onConfirm,
}: {
  current?: string;
  onClose: () => void;
  onConfirm: (src: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    request = useRef(0);
  const [src, setSrc] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false),
    [school, setSchool] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      request.current++;
    };
  }, []);
  const load = async (file?: File) => {
    if (!file) return;
    const id = ++request.current;
    setError("");
    setBusy(true);
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 1500000
      )
        throw new Error("请选择 1.5 MB 以内的 PNG、JPG 或 WebP 图片。");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("图片读取失败，请重新选择。"));
        reader.readAsDataURL(file);
      });
      const image = new Image();
      image.src = data;
      await image.decode();
      if (id === request.current) {
        setSrc(data);
        setName(file.name);
      }
    } catch (e) {
      if (id === request.current) {
        setSrc("");
        setName("");
        setError(
          e instanceof Error ? e.message : "这张图片无法打开，请换一张。",
        );
      }
    } finally {
      if (id === request.current) setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="crest-dialog"
      aria-labelledby="crest-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header>
        <div>
          <GraduationCap size={23} />
          <h2 id="crest-title">为简历添上校徽</h2>
        </div>
        <button
          type="button"
          autoFocus
          aria-label="关闭校徽窗口"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <p className="crest-intro">
        选择清晰的校徽，原图比例会保留。确认后可在纸上移动、缩放。
      </p>
      <button
        type="button"
        className={`crest-drop ${dragging ? "dragging" : ""}`}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void load(e.dataTransfer.files[0]);
        }}
      >
        {src || current ? (
          <img src={src || current} alt="校徽预览" />
        ) : (
          <Upload size={30} />
        )}
        <strong>
          {busy ? "正在读取图片…" : src ? name : "选择校徽文件，或拖到这里"}
        </strong>
        <span>{src ? "点击可重新选择" : "PNG / JPG / WebP · 最大 1.5 MB"}</span>
      </button>
      <input
        ref={input}
        hidden
        type="file"
        aria-label="校徽文件"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          void load(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="crest-error" role="alert">
          {error}
        </p>
      )}
      <section className="crest-search">
        <h3>还没有校徽？</h3>
        <p>到维基共享资源查找，保存合适的图片后回到这里上传。</p>
        <div>
          <label className="crest-query">
            <Search size={16} />
            <input
              aria-label="搜索学校名称"
              placeholder="输入学校名称"
              value={school}
              maxLength={100}
              onChange={(e) => setSchool(e.target.value)}
            />
          </label>
          <a
            href={`https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=${encodeURIComponent((school.trim() || "university") + " logo")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            查找校徽
            <ArrowUpRight size={15} />
          </a>
        </div>
        <small>公益媒体图库 · 在新页面打开 · 图片授权请以图源页面为准</small>
      </section>
      <footer>
        <button type="button" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="primary"
          disabled={!src || busy}
          onClick={() => {
            try {
              onConfirm(src);
              onClose();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "校徽添加失败，请重试。",
              );
            }
          }}
        >
          使用这张校徽
        </button>
      </footer>
    </dialog>
  );
}
