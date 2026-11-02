const { Plugin } = require('obsidian');
const { ViewPlugin, Decoration } = require('@codemirror/view');
const { RangeSetBuilder } = require('@codemirror/state');

function buildShakeDecorations(view) {
  const builder = new RangeSetBuilder();
  const regex = /\+\!([\s\S]*?)\!\+/g;

  for (let { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchStart = from + match.index;
      const matchEnd = from + regex.lastIndex;
      const innerText = match[1];

      builder.add(matchStart, matchStart + 2, Decoration.mark({ 
        attributes: { style: "color: transparent !important; font-size: 0.001px !important; letter-spacing: -1px !important;" } 
      }));

      for (let i = 0; i < innerText.length; i++) {
        const charPos = matchStart + 2 + i;
        const delay = (i % 4 === 0) ? "-0.05s" : (i % 4 === 1) ? "-0.15s" : (i % 4 === 2) ? "-0.09s" : "-0.02s";
        
        builder.add(charPos, charPos + 1, Decoration.mark({
          attributes: { 
            style: `display: inline-block !important; white-space: pre !important; animation: letter-vibrate 0.25s infinite linear !important; animation-delay: ${delay} !important;` 
          }
        }));
      }

      builder.add(matchEnd - 2, matchEnd, Decoration.mark({ 
        attributes: { style: "color: transparent !important; font-size: 0.001px !important; letter-spacing: -1px !important;" } 
      }));
    }
  }
  return builder.finish();
}

module.exports = class RPGShakePlugin extends Plugin {
  async onload() {
    const styleEl = document.createElement('style');
    styleEl.id = 'rpg-shake-styles';
    styleEl.textContent = `
      @keyframes letter-vibrate {
        0%   { transform: translate(0.3px, 1.2px); }
        25%  { transform: translate(-0.4px, -1.0px); }
        50%  { transform: translate(-0.3px, 1.5px); }
        75%  { transform: translate(0.4px, -1.2px); }
        100% { transform: translate(0.3px, 1.2px); }
      }

      @keyframes menu-icon-vibrate {
        0%   { transform: translate(0.5px, 0.5px) rotate(0deg); }
        20%  { transform: translate(-0.5px, -0.5px) rotate(-1deg); }
        40%  { transform: translate(-1px, 0.5px) rotate(1deg); }
        60%  { transform: translate(1px, -0.5px) rotate(0deg); }
        80%  { transform: translate(-0.5px, 0.5px) rotate(1deg); }
        100% { transform: translate(0.5px, 0.5px) rotate(0deg); }
      }

      .shake {
        display: inline-block !important;
        white-space: pre !important;
        animation: letter-vibrate 0.25s infinite linear !important;
      }
      .shake:nth-child(2n) { animation-delay: -0.05s !important; }
      .shake:nth-child(3n) { animation-delay: -0.15s !important; }
      .shake:nth-child(4n) { animation-delay: -0.09s !important; }
      .shake:nth-child(5n) { animation-delay: -0.02s !important; }

      .rpg-menu-item-shake svg {
        animation: menu-icon-vibrate 0.3s infinite linear !important;
      }
    `;
    document.head.appendChild(styleEl);

    const executeToggle = (editor) => {
      const selection = editor.getSelection();
      if (!selection) return;

      if (selection.startsWith("+!") && selection.endsWith("!+")) {
        const unwrapped = selection.substring(2, selection.length - 2);
        editor.replaceSelection(unwrapped);
      } else {
        editor.replaceSelection(`+!${selection}!+`);
      }
    };

    this.addCommand({
      id: 'toggle-rpg-shake',
      name: 'Shake Text',
      hotkeys: [{ modifiers: ['Alt', 'Shift'], key: 's' }],
      editorCallback: (editor) => executeToggle(editor)
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        if (editor.getSelection() === "") return;

        menu.addItem((item) => {
          item
            .setSection("selection")
            .setTitle("Shake")
            .setIcon("activity")
            .onClick(() => executeToggle(editor));

          if (item.dom) {
            item.dom.classList.add("rpg-menu-item-shake");
          }
        });
      })
    );

    const shakeViewPlugin = ViewPlugin.fromClass(
      class {
        constructor(view) { this.decorations = buildShakeDecorations(view); }
        update(update) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = buildShakeDecorations(update.view);
          }
        }
      },
      { decorations: v => v.decorations }
    );
    this.registerEditorExtension([shakeViewPlugin]);

    this.registerMarkdownPostProcessor((element) => {
      const elements = element.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6");
      elements.forEach(el => {
        let html = el.innerHTML;
        const regex = /\+\!([\s\S]*?)\!\+/g;
        
        if (regex.test(html)) {
          html = html.replace(regex, (match, textContent) => {
            const temp = document.createElement("span");
            temp.innerHTML = textContent;
            
            const processNodes = (node) => {
              const children = Array.from(node.childNodes);
              children.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                  const spanWrap = document.createElement("span");
                  [...child.nodeValue].forEach(char => {
                    const cSpan = document.createElement("span");
                    cSpan.className = "shake";
                    cSpan.textContent = char;
                    spanWrap.appendChild(cSpan);
                  });
                  child.parentNode.replaceChild(spanWrap, child);
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                  processNodes(child);
                }
              });
            };
            
            processNodes(temp);
            return temp.innerHTML;
          });
          el.innerHTML = html;
        }
      });
    });
  }

  onunload() {
    const styleEl = document.getElementById('rpg-shake-styles');
    if (styleEl) styleEl.remove();
  }
};
