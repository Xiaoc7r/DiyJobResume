import { useEffect, useRef, useState } from "react";
import { X, GraduationCap, ArrowUpRight, UserRound } from "lucide-react";

export function ImageUploadDialog({
  kind,
  current,
  onClose,
  onConfirm,
}: {
  kind: "证件照" | "校徽";
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
    [dragging, setDragging] = useState(false);
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
      className={`image-upload-dialog ${kind === "证件照" ? "is-photo" : "is-crest"}`}
      aria-label={`上传${kind}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPaste={(e) => {
        const item = [...e.clipboardData.items].find((item) =>
          item.type.startsWith("image/"),
        );
        if (item) {
          e.preventDefault();
          void load(item.getAsFile() || undefined);
        }
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
          <h2>上传{kind}</h2>
        </div>
        <button
          type="button"
          autoFocus
          aria-label={`关闭${kind}窗口`}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
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
          <img src={src || current} alt={`${kind}预览`} />
        ) : kind === "证件照" ? (
          <UserRound size={36} />
        ) : (
          <GraduationCap size={36} />
        )}
        <strong>
          {busy ? "正在读取图片…" : src ? name : `选择${kind}或拖入`}
        </strong>
        <span>{src ? "重新选择" : "PNG · JPG · WebP · 1.5 MB"}</span>
      </button>
      <input
        ref={input}
        hidden
        type="file"
        aria-label={`${kind}文件`}
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
      <footer>
        {kind === "校徽" && (
          <a
            className="crest-library-link"
            href="https://www.urongda.com/logos"
            target="_blank"
            rel="noopener noreferrer"
          >
            查找校徽
            <ArrowUpRight size={14} />
          </a>
        )}
        <div>
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
                  e instanceof Error ? e.message : `${kind}添加失败，请重试。`,
                );
              }
            }}
          >
            确认添加
          </button>
        </div>
      </footer>
    </dialog>
  );
}
