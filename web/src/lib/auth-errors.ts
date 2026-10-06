/** 把 Supabase Auth 的英文錯誤轉成看得懂的中文 */
export function authErrorMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Email 或密碼不正確';
  if (/email not confirmed/i.test(message)) return '這個帳號還沒完成 Email 驗證，請先點確認信裡的連結';
  if (/already (been )?registered|already exists/i.test(message)) return '這個 Email 已經註冊過了，請直接登入；忘記密碼可以重設';
  if (/signups? (are )?not allowed|signup.*disabled/i.test(message)) return '目前不開放註冊';
  if (/not authorized/i.test(message)) return '內建寄信服務只能寄給 Supabase 專案成員的 Email';
  if (/rate limit|too many/i.test(message)) return '操作太頻繁，請稍後再試';
  if (/password should be at least|weak password/i.test(message)) return '密碼太短，至少要 8 個字元';
  if (/should be different from the old password/i.test(message)) return '新密碼不能跟舊密碼一樣';
  if (/session missing|session_not_found/i.test(message)) return '連結已失效，請重新申請重設密碼';
  if (/unable to validate email|invalid format|email address .* is invalid/i.test(message)) return 'Email 格式不正確';
  return message;
}
