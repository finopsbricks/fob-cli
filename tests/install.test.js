import { describe, it, expect } from '@jest/globals';
import { onPath, pathHint } from '../src/install.js';

describe('onPath', () => {
  it('matches exactly on POSIX, ignoring trailing slashes', () => {
    expect(onPath('/home/a/.fob/bin', { PATH: '/usr/bin:/home/a/.fob/bin/' }, 'linux')).toBe(true);
    expect(onPath('/home/a/.fob/bin', { PATH: '/usr/bin:/home/a/.FOB/bin' }, 'linux')).toBe(false);
    expect(onPath('/home/a/.fob/bin', { Path: '/home/a/.fob/bin' }, 'linux')).toBe(false); // env names are case-sensitive
  });
  it('is case- and separator-insensitive on win32, and finds `Path`', () => {
    const dir = 'C:\\Users\\a\\.fob\\bin';
    expect(onPath(dir, { Path: 'C:\\Windows;c:\\users\\A\\.fob\\bin\\' }, 'win32')).toBe(true);
    expect(onPath(dir, { PATH: 'C:/Users/a/.fob/bin' }, 'win32')).toBe(true);
    expect(onPath(dir, { Path: '"C:\\Users\\a\\.fob\\bin"' }, 'win32')).toBe(true);
    expect(onPath(dir, { Path: 'C:\\Windows' }, 'win32')).toBe(false);
  });
});

describe('pathHint', () => {
  it('gives an export line on POSIX', () => {
    expect(pathHint('/h/.fob/bin', 'darwin').join('\n')).toContain('export PATH="/h/.fob/bin:$PATH"');
  });
  it('gives a PowerShell user-PATH line on win32, quoting apostrophes', () => {
    const hint = pathHint("C:\\Users\\O'Brien\\.fob\\bin", 'win32').join('\n');
    expect(hint).toContain("[Environment]::SetEnvironmentVariable('Path', 'C:\\Users\\O''Brien\\.fob\\bin;' +");
    expect(hint).not.toContain('export PATH');
  });
});
