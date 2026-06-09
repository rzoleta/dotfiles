return {
  {
    "nvim-neo-tree/neo-tree.nvim",
    opts = {
      filesystem = {
        filtered_items = {
          visible = true,
          hide_dotfiles = false,
          hide_gitignored = false,
          hide_hidden = false,
        },
      },
    },
  },
  {
    "snacks.nvim",
    opts = {
      scroll = { enabled = false },
      indent = { enabled = false },
    },
  },
  {
    "nvim-mini/mini.indentscope",
    enabled = false,
  },
}
