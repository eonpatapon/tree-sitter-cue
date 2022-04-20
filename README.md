# tree-sitter-cue

[Cue][] grammar for [tree-sitter][].

![AST and hilights in neovim](./neovim-ts.png)

## Setup in neovim

```lua
-- This is required to not have cue files marked as `cuesheet`
vim.api.nvim_create_autocmd({"BufEnter", "BufWinEnter"}, {
        pattern = {"*.cue"},
        command = "set filetype=cue",
})

local parser_config = require "nvim-treesitter.parsers".get_parser_configs()
parser_config.cue = {
  install_info = {
    url = "https://github.com/eonpatapon/tree-sitter-cue", -- local path or git repo
    files = {"src/parser.c", "src/scanner.c"},
    branch = "main"
  },
  filetype = "cue", -- if filetype does not agrees with parser name
}

treesitter.setup {
  ensure_installed = {
    "cue",
    ...
  }
}
```

For highlighting to work, copy
[./queries/highlights.scm](./queries/highlights.scm) in your nvim configuration
(usually `~/.config/nvim`) in a directory `queries/cue/`.

Alternatively the `queries` directory can be put in any directory referenced in
nvim `runtimepath`.

### Custom captures

You can customize highlighting further by remapping captures to nvim highlighting
groups like so:

```lua
treesitter.setup {

  highlight = {
    enable = true,
    additional_vim_regex_highlighting = false,
    custom_captures = {
      --- cue
      ["operator.default"] = "Statement",
      ["operator.regexp"] = "Statement",
      ["operator.unify"] = "Statement",
      ["operator.disjunct"] = "Label",
      ["definition"] = "Bold"
    }
  }

}
```


[tree-sitter]: https://github.com/tree-sitter/tree-sitter
[Cue]: https://github.com/cue-lang/cue
