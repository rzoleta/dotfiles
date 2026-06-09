local no_inlay_hints = {
  parameterNames = { enabled = "none" },
  parameterTypes = { enabled = false },
  variableTypes = { enabled = false },
  propertyDeclarationTypes = { enabled = false },
  functionLikeReturnTypes = { enabled = false },
  enumMemberValues = { enabled = false },
}

return {
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        svelte = {
          settings = {
            typescript = { inlayHints = no_inlay_hints },
            javascript = { inlayHints = no_inlay_hints },
          },
        },
        vtsls = {
          settings = {
            typescript = { inlayHints = no_inlay_hints },
            javascript = { inlayHints = no_inlay_hints },
          },
        },
        ts_ls = {
          settings = {
            typescript = { inlayHints = no_inlay_hints },
            javascript = { inlayHints = no_inlay_hints },
          },
        },
      },
    },
  },
}
