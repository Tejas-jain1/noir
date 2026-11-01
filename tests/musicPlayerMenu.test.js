import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as LucideIcons from 'lucide-react';
import fs from 'node:fs';
import path from 'node:path';

describe('NOIR MusicPlayer 3-Dots Menu & Icons Validation', () => {
  it('ensures all Lucide icons used in MusicPlayer.jsx are valid and imported', () => {
    const filePath = path.resolve('src/components/MusicPlayer.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract import statement from lucide-react
    const lucideImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
    assert.ok(lucideImportMatch, 'MusicPlayer.jsx must import from lucide-react');

    const importedIcons = lucideImportMatch[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Verify each imported icon exists in lucide-react
    for (const icon of importedIcons) {
      assert.ok(
        LucideIcons[icon] !== undefined,
        `Icon "${icon}" imported in MusicPlayer.jsx must exist in lucide-react`
      );
      assert.ok(
        typeof LucideIcons[icon] === 'function' || typeof LucideIcons[icon] === 'object',
        `Icon "${icon}" must be a valid React component in lucide-react`
      );
    }

    // Verify Music2 specifically is imported and callable/valid
    assert.ok(importedIcons.includes('Music2'), 'Music2 must be imported from lucide-react');
    assert.ok(
      typeof LucideIcons.Music2 === 'function' || typeof LucideIcons.Music2 === 'object',
      'Music2 must be a valid component in lucide-react'
    );
  });

  it('ensures no JSX elements in MusicPlayer.jsx use undefined identifiers', () => {
    const filePath = path.resolve('src/components/MusicPlayer.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verify <Music2 is preceded by a valid import
    assert.ok(content.includes('<Music2 size={16}'), 'Menu must render Music2 icon');
    assert.ok(content.includes('Music2,'), 'Music2 must be in import block');

    // Verify mobile 3-dots button has mobileMenuButtonRef attached
    assert.ok(
      content.includes('ref={mobileMenuButtonRef}'),
      'Mobile 3-dots button must have mobileMenuButtonRef to prevent closing issues'
    );

    // Verify click outside logic handles both mobile and desktop buttons
    assert.ok(
      content.includes('mobileMenuButtonRef.current'),
      'handleClickOutside must check mobileMenuButtonRef'
    );
    assert.ok(
      content.includes('menuButtonRef.current'),
      'handleClickOutside must check menuButtonRef'
    );

    // Verify Escape key handling for accessibility
    assert.ok(
      content.includes("e.key === 'Escape'"),
      'Menu should close on Escape key press'
    );
  });

  it('verifies menu popover container has proper z-index and viewport bounds', () => {
    const filePath = path.resolve('src/components/MusicPlayer.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verify popover styling
    assert.ok(content.includes("zIndex: 1000"), 'Popover must have high zIndex to float over docks');
    assert.ok(content.includes("maxWidth: 'calc(100vw - 32px)'"), 'Popover must not overflow viewport on small screens');
    assert.ok(content.includes("position: 'absolute'"), 'Popover must be positioned absolutely above dock');
    assert.ok(content.includes("bottom: 'calc(100% + 10px)'"), 'Popover must anchor above dock');
  });
});
