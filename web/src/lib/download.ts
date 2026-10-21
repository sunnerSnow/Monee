'use client';

/** 讓瀏覽器下載一個檔案（備份檔、明細 CSV） */
export function saveFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  // Safari 要等下載開始才能放掉
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
