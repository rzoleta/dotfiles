return {
  {
    "folke/persistence.nvim",
    lazy = false,
    priority = 1000,
    opts = {
      autoload = true,
    },
    init = function()
      -- Auto-restore last session for cwd when nvim is opened with no file args
      vim.api.nvim_create_autocmd("VimEnter", {
        nested = true,
        callback = function()
          if vim.fn.argc() == 0 and vim.bo.filetype ~= "gitcommit" then
            require("persistence").load()
          end
        end,
      })
    end,
  },
}
