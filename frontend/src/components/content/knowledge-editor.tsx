'use client';

import { useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import {
  Bold, Italic, Strikethrough, Link2, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, FileCode, ImageIcon, ImagePlus, Loader2, Table2,
  Minus, Undo, Redo,
} from 'lucide-react';
import { api } from '@/lib/api';
import { uploadError } from '@/components/content/image-upload-field';

/**
 * Edytor materiałów bazy wiedzy.
 *
 * Osobny od `RichTextEditor`, który obsługuje posty forum — i to jest
 * jedyny powód, dla którego istnieją dwa. Post forum to kilka akapitów
 * z linkiem; artykuł ma nagłówki trzech poziomów, tabele, obrazki
 * i bloki kodu. Wspólny edytor oznaczałby albo pasek narzędzi z tuzinem
 * przycisków nad polem komentarza, albo artykuł bez tabel.
 *
 * Współdzielą całą resztę: te same rozszerzenia TipTapa, ten sam styl
 * `prose-editor`, ten sam kontrakt `content` / `onChange`.
 */
interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function KnowledgeEditor({ content, onChange, placeholder = 'Treść materiału…' }: Props) {
  const editor = useEditor({
    extensions: [
      // Trzy poziomy nagłówków: H1 jest tytułem materiału, więc w treści
      // zaczynamy od H2 — ale poradnik z sekcjami i podsekcjami potrzebuje
      // trzeciego poziomu.
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-accent hover:underline', target: '_blank', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({ placeholder }),
      Image.configure({ HTMLAttributes: { class: 'rounded-lg' } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose-editor outline-none px-3 py-3 text-sm text-content-primary min-h-[400px]',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-base focus-within:border-accent/50">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const setLink = useCallback(() => {
    const previous = editor.getAttributes('link').href;
    const url = window.prompt('Adres odnośnika', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  /**
   * Wstawienie obrazka — z dysku albo z adresu.
   *
   * Wcześniej dostępne było wyłącznie pytanie o adres, więc żeby dodać
   * własny zrzut ekranu, trzeba go było najpierw gdzieś wgrać. Teraz
   * plik idzie prosto do naszej biblioteki i wraca gotowym adresem.
   */
  const insertImage = useCallback((src: string, alt: string) => {
    editor.chain().focus().setImage({ src, alt }).run();
  }, [editor]);

  const uploadImage = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Tekst alternatywny pytamy od razu: dopisanie go później wymaga
      // pamiętania, że się go pominęło, a nikt nie pamięta.
      const alt = window.prompt('Tekst alternatywny (opis obrazka dla czytnika ekranu)') ?? '';
      if (alt) fd.append('alt', alt);
      const { data } = await api.post('/media/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      insertImage(data.url, alt);
    } catch (e) {
      window.alert(uploadError(e));
    } finally {
      setUploading(false);
    }
  }, [insertImage]);

  const addImageByUrl = useCallback(() => {
    const url = window.prompt('Adres obrazka');
    if (!url) return;
    const alt = window.prompt('Tekst alternatywny (opis obrazka dla czytnika ekranu)') ?? '';
    insertImage(url, alt);
  }, [insertImage]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface-raised px-2 py-1.5">
      <Group>
        <Btn on={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="Nagłówek 1"><Heading1 /></Btn>
        <Btn on={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Nagłówek 2"><Heading2 /></Btn>
        <Btn on={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="Nagłówek 3"><Heading3 /></Btn>
      </Group>

      <Group>
        <Btn on={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="Pogrubienie"><Bold /></Btn>
        <Btn on={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="Kursywa"><Italic /></Btn>
        <Btn on={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} label="Przekreślenie"><Strikethrough /></Btn>
        <Btn on={editor.isActive('link')} onClick={setLink} label="Odnośnik"><Link2 /></Btn>
      </Group>

      <Group>
        <Btn on={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Lista"><List /></Btn>
        <Btn on={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Lista numerowana"><ListOrdered /></Btn>
        <Btn on={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="Cytat"><Quote /></Btn>
      </Group>

      <Group>
        <Btn on={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} label="Kod w linii"><Code /></Btn>
        <Btn on={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} label="Blok kodu"><FileCode /></Btn>
      </Group>

      <Group>
        <Btn
          onClick={() => fileRef.current?.click()}
          label={uploading ? 'Wgrywam obrazek…' : 'Wgraj obrazek z dysku'}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        </Btn>
        <Btn onClick={addImageByUrl} label="Obrazek z adresu"><ImageIcon /></Btn>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadImage(f);
            e.target.value = '';
          }}
        />
        <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} label="Tabela"><Table2 /></Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Linia pozioma"><Minus /></Btn>
      </Group>

      <Group last>
        <Btn onClick={() => editor.chain().focus().undo().run()} label="Cofnij"><Undo /></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} label="Ponów"><Redo /></Btn>
      </Group>
    </div>
  );
}

function Group({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center gap-0.5 ${last ? '' : 'mr-1 border-r border-line pr-1'}`}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, on, label }: {
  children: React.ReactNode;
  onClick: () => void;
  on?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className={`rounded p-1.5 transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5 ${
        on ? 'bg-accent/15 text-accent' : 'text-content-muted hover:bg-surface-hover hover:text-content-primary'
      }`}
    >
      {children}
    </button>
  );
}
