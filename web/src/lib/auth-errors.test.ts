import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './auth-errors';

describe('authErrorMessage', () => {
  it.each([
    ['Invalid login credentials', 'Email 或密碼不正確'],
    ['Email not confirmed', '這個帳號還沒完成 Email 驗證，請先點確認信裡的連結'],
    ['User already registered', '這個 Email 已經註冊過了，請直接登入；忘記密碼可以重設'],
    ['Signups not allowed for this instance', '目前不開放註冊'],
    ['Email address "a@b.com" not authorized', '內建寄信服務只能寄給 Supabase 專案成員的 Email'],
    ['email rate limit exceeded', '操作太頻繁，請稍後再試'],
    ['Password should be at least 6 characters.', '密碼太短，至少要 8 個字元'],
    ['New password should be different from the old password.', '新密碼不能跟舊密碼一樣'],
  ])('%s', (input, expected) => {
    expect(authErrorMessage(input)).toBe(expected);
  });

  it('沒對應到的訊息原樣保留', () => {
    expect(authErrorMessage('Something odd')).toBe('Something odd');
  });
});
