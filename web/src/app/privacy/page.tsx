import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BubbleLogo } from '@/components/ui';

export const metadata: Metadata = { title: '隱私權政策' };

const CONTACT = 'lovepeace.yuki@gmail.com';
const UPDATED = '2026 年 10 月 22 日';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card flex flex-col gap-3 p-5 text-body-s leading-[1.9]">
      <h2 id={id} className="font-display text-body tracking-[.1em]">{title}</h2>
      {children}
    </section>
  );
}

const List = ({ children }: { children: ReactNode }) => <ul className="flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;
const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{children}</a>
);

/** 隱私權政策：不用登入就看得到（Google 授權畫面、登入頁都連到這裡） */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-5 py-10">
      <header className="flex flex-col gap-3">
        <Link href="/" aria-label="回到 Monee" className="press self-start"><BubbleLogo className="text-[40px]" /></Link>
        <h1 className="h-page">隱私權政策<span className="en">Privacy</span></h1>
        <p className="caption">最後更新：{UPDATED}</p>
        <p className="text-body-s leading-[1.9]">
          Monee 是個人開發的免費記帳網頁，不放廣告、不賣資料，也沒有任何追蹤或分析工具。這份說明 Monee 會保存哪些資料、怎麼使用，以及你可以怎麼管理。
        </p>
      </header>

      <Section id="p-collect" title="Monee 保存哪些資料">
        <List>
          <li><b>帳號</b>：Email。密碼由登入服務（Supabase Auth）加密保存，任何人都看不到原文。登入狀態用 Cookie 記住。</li>
          <li><b>你記的帳</b>：交易、帳戶、預算、分類、固定收支、無消費日，以及分帳群組（包含你輸入的朋友名字、你的收款方式）。</li>
          <li><b>收據照片</b>：只有你選擇附上時才保存。</li>
          <li><b>偏好設定</b>：深淺色、角色、隱藏金額，存在你自己的瀏覽器裡。</li>
        </List>
        <p>Monee 不收集位置、通訊錄或廣告識別碼。</p>
      </Section>

      <Section id="p-where" title="資料存在哪裡、誰看得到">
        <List>
          <li>資料庫和收據照片存在 Supabase，網站由 Vercel 提供。</li>
          <li>每個人只能讀寫自己的資料，由資料庫的權限規則把關。</li>
          <li>開發者為了維運，技術上看得到資料庫；除了排除問題或你提出要求，不會查看你的資料。</li>
        </List>
      </Section>

      <Section id="p-third" title="會用到的其他服務">
        <List>
          <li>
            <b>Google Gemini（AI 記帳）</b>：按「說一句」「拍收據」或打一句話時，錄音、照片或文字會連同你的帳戶名稱、分類名稱（分帳時還有成員名字）送到 Google Gemini API，整理成記帳草稿。Monee 不保存錄音。
            Monee 目前使用 Gemini API 的免費額度；依 Google 的條款，免費額度送出的內容可能被 Google 用來改善服務，也可能經人工審閱（審閱前會和帳號資訊分開）。不想這樣的話，請改用手動輸入。
          </li>
          <li><b>瀏覽器的語音辨識</b>：在部分瀏覽器（例如 Chrome、Safari）邊說邊顯示文字時，聲音會由瀏覽器送到 Google 或 Apple 轉成文字。</li>
          <li><b>匯率</b>：向 open.er-api.com 查詢匯率，不會送出任何個人資料。</li>
        </List>
      </Section>

      <Section id="p-google" title="Google 帳號與 Google 雲端硬碟">
        <List>
          <li>「匯出到 Google Sheets」和「Google 雲端同步」需要你授權自己的 Google 帳號，不用的話不必授權。</li>
          <li>
            權限只有 <b>drive.file</b>：Monee 只能建立、讀寫它自己建立的檔案（Monee 資料夾、收據、年度帳本、匯出的試算表），看不到你雲端硬碟裡的其他檔案。
            另外的 openid、email 只用來顯示你連結的是哪個 Google 帳號。
          </li>
          <li>這些權限只用來把你的記帳資料和收據寫進你自己的雲端硬碟；不用來投放廣告、不轉交給其他人，也不拿去訓練 AI。</li>
          <li>Google 雲端同步的長期授權會加密後存在伺服器；匯出到 Google Sheets 的授權只放在瀏覽器的記憶體裡。</li>
          <li>
            在「我的 → Google 雲端同步」解除連結會撤銷授權，也可以到 <A href="https://myaccount.google.com/connections">Google 帳號的「第三方應用程式和服務」</A>移除 Monee。
            已經放進雲端硬碟的檔案在你自己的帳號裡，由你保管，Monee 不會刪除。
          </li>
        </List>
        <p>
          Monee 使用和傳輸從 Google API 取得的資訊時，遵守 <A href="https://developers.google.com/terms/api-services-user-data-policy">Google API 服務使用者資料政策</A>（Google API Services User Data Policy），包括其中的有限使用（Limited Use）規定。
        </p>
      </Section>

      <Section id="p-share" title="分帳分享連結">
        <p>
          你在分帳群組開啟分享時，拿到連結的人不用登入，就能看到這個群組的成員名字、花費、還款和你的收款方式，也能說已付款、新增花費。
          他們看不到你的帳戶、其他交易或 Email。你可以隨時重設連結或停止分享。
        </p>
      </Section>

      <Section id="p-rights" title="你的資料由你作主">
        <List>
          <li>隨時可以在 App 裡修改、刪除帳，也可以在「我的 → 資料」下載備份檔或明細 CSV。</li>
          <li>資料會保存到你刪除為止。還原備份時，會自動留一份還原前的資料，方便換回來；下次還原時會被換掉。</li>
          <li>要刪除帳號和全部資料，請寫信到 <a href={`mailto:${CONTACT}`} className="underline underline-offset-4">{CONTACT}</a>，會在 30 天內刪除。雲端硬碟裡的檔案在你自己的帳號裡，請自行刪除。</li>
        </List>
      </Section>

      <Section id="p-change" title="修改與聯絡">
        <p>這份說明有重要修改時，會更新這一頁和上面的日期。有任何問題，歡迎寫信到 <a href={`mailto:${CONTACT}`} className="underline underline-offset-4">{CONTACT}</a>。</p>
      </Section>

      <Link href="/" className="btn-secondary press self-center">回到 Monee</Link>
    </main>
  );
}
