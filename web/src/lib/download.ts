'use client';

/** 讓瀏覽器下載一個檔案（備份檔、明細 CSV） */
export function saveFile(name: string, text: string, type: string) {
  saveBlob(name, new Blob([text], { type }));
}

/** 下載圖片這類二進位檔（年度回顧的分享圖） */
export function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  // Safari 要等下載開始才能放掉
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
