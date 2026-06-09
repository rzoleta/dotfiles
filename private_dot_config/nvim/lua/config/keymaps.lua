-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

-- Disable Ctrl+Z (don't suspend nvim — it leaves stale processes around)
vim.keymap.set({ "n", "i", "v", "x" }, "<C-z>", "<Nop>", { desc = "Disabled (was: suspend)" })

-- Toggle focus between Neo-tree and the editor (instead of hide/show)
vim.keymap.set("n", "<leader>e", function()
  if vim.bo.filetype == "neo-tree" then
    vim.cmd("wincmd p") -- jump to previous (editor) window
  else
    vim.cmd("Neotree focus")
  end
end, { desc = "Focus Neo-tree / editor" })
