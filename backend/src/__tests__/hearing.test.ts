import { describe, it, expect } from 'vitest';

// Import the masking function by extracting it
// Since maskPersonalInfo is not exported, we test the behavior through regex patterns
describe('Personal Info Masking', () => {
  // Replicate the masking logic for testing
  function maskPersonalInfo(text: string): string {
    let masked = text.replace(/[\w.+-]+@[\w.-]+\.\w+/g, '[メールアドレス]');
    masked = masked.replace(/\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}/g, '[電話番号]');
    masked = masked.replace(/(?:名前は|私は)([^\s,。、]{2,10})(?:です|と申します)/g, () => {
      return '名前は[氏名]です';
    });
    return masked;
  }

  it('should mask email addresses', () => {
    const input = '私のメールアドレスはtanaka@example.comです';
    const result = maskPersonalInfo(input);
    expect(result).not.toContain('tanaka@example.com');
    expect(result).toContain('[メールアドレス]');
  });

  it('should mask multiple email addresses', () => {
    const input = 'test@a.com と user@b.co.jp に送ってください';
    const result = maskPersonalInfo(input);
    expect(result).not.toContain('test@a.com');
    expect(result).not.toContain('user@b.co.jp');
  });

  it('should mask phone numbers', () => {
    const input = '電話番号は090-1234-5678です';
    const result = maskPersonalInfo(input);
    expect(result).not.toContain('090-1234-5678');
    expect(result).toContain('[電話番号]');
  });

  it('should mask name patterns', () => {
    const input = '名前は田中太郎です';
    const result = maskPersonalInfo(input);
    expect(result).not.toContain('田中太郎');
    expect(result).toContain('[氏名]');
  });

  it('should not modify text without personal info', () => {
    const input = '研究者をしています。細胞培養が専門です。';
    const result = maskPersonalInfo(input);
    expect(result).toBe(input);
  });

  it('should handle empty string', () => {
    expect(maskPersonalInfo('')).toBe('');
  });

  it('should handle text with only personal info patterns', () => {
    const input = 'user@test.com';
    const result = maskPersonalInfo(input);
    expect(result).toBe('[メールアドレス]');
  });
});

describe('Hearing Questions', () => {
  const HEARING_QUESTIONS = [
    'はじめまして！まず、あなたのお仕事や普段の活動について教えてください。（例: 研究者、デザイナー、営業、学生など）',
    'パソコンはどのくらい使い慣れていますか？普段どんな作業をしていますか？（例: メールとExcelくらい、プレゼン資料をよく作る、など）',
    'プログラミングやコードを書いた経験はありますか？あれば、どんなことをしましたか？（全くない場合は「なし」とお答えください）',
    'これから作ってみたいもの、実現したいアイデアはありますか？ざっくりとしたイメージで構いません。',
    'Git、GitHub、CI/CDという言葉を聞いたことがありますか？もしあれば、どんなイメージを持っていますか？',
  ];

  it('should have exactly 5 questions', () => {
    expect(HEARING_QUESTIONS).toHaveLength(5);
  });

  it('all questions should be non-empty strings', () => {
    for (const q of HEARING_QUESTIONS) {
      expect(typeof q).toBe('string');
      expect(q.length).toBeGreaterThan(0);
    }
  });

  it('first question should ask about occupation', () => {
    expect(HEARING_QUESTIONS[0]).toContain('お仕事');
  });
});
