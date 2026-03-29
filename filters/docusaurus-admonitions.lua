--- docusaurus-admonitions.lua
--- Pandoc Lua filter for Docusaurus-style admonition blocks.
--- Transforms :::note, :::tip, :::info, :::warning, :::danger fenced divs
--- into format-appropriate styled admonitions.

local admonition_types = {
  note    = { label = "Note",    border = "#448aff", bg = "#e7f2ff", latex_color = "blue" },
  tip     = { label = "Tip",     border = "#00c853", bg = "#e6f9ed", latex_color = "green" },
  info    = { label = "Info",    border = "#00b0ff", bg = "#e3f5fc", latex_color = "cyan" },
  warning = { label = "Warning", border = "#ff9100", bg = "#fff8e1", latex_color = "orange" },
  danger  = { label = "Danger",  border = "#ff1744", bg = "#ffe8e8", latex_color = "red" },
  caution = { label = "Caution", border = "#ff9100", bg = "#fff8e1", latex_color = "orange" },
}

--- Check if a Div element is an admonition and return its type key.
local function get_admonition_type(el)
  for _, class in ipairs(el.classes) do
    if admonition_types[class] then
      return class
    end
  end
  return nil
end

--- Extract a custom title from the Div.
--- Docusaurus uses :::note[Custom Title] which Pandoc may parse as
--- a bracketed span or as the div's title attribute.
local function get_title(el, admon_type)
  -- Check for a title attribute set by Pandoc
  local attr_title = el.attributes and el.attributes["title"]
  if attr_title and attr_title ~= "" then
    return attr_title
  end

  -- Check if the first inline of the first block is a bracketed Span
  -- that acts as a Docusaurus custom title
  if #el.content > 0 then
    local first_block = el.content[1]
    if first_block.tag == "Para" or first_block.tag == "Plain" then
      local inlines = first_block.content
      if #inlines > 0 and inlines[1].tag == "Span" then
        local span = inlines[1]
        -- Check if this span looks like a title (has no special classes)
        local title_text = pandoc.utils.stringify(span)
        if title_text ~= "" then
          -- Remove the title span from content
          local remaining = pandoc.List()
          for i = 2, #inlines do
            remaining:insert(inlines[i])
          end
          -- If remaining inlines exist, replace the first block
          if #remaining > 0 then
            -- Skip leading space after title
            if remaining[1].tag == "Space" then
              remaining:remove(1)
            end
            el.content[1] = pandoc.Para(remaining)
          else
            -- Remove the entire first block if only the title was there
            el.content:remove(1)
          end
          return title_text
        end
      end
    end
  end

  -- Default to the admonition type label
  return admonition_types[admon_type].label
end

--- Hex color to LaTeX-compatible RGB definition.
local function hex_to_latex_rgb(hex)
  hex = hex:gsub("#", "")
  local r = tonumber(hex:sub(1, 2), 16) / 255
  local g = tonumber(hex:sub(3, 4), 16) / 255
  local b = tonumber(hex:sub(5, 6), 16) / 255
  return string.format("%.3f,%.3f,%.3f", r, g, b)
end

-- Track whether we have injected tcolorbox into the header
local tcolorbox_injected = false

--- Inject tcolorbox package into document metadata (for LaTeX/PDF).
local function ensure_tcolorbox(meta)
  if tcolorbox_injected then
    return meta
  end
  tcolorbox_injected = true

  local header_includes = meta["header-includes"]
  local tcolorbox_pkg = pandoc.RawBlock("latex",
    "\\usepackage[most]{tcolorbox}")

  if header_includes == nil then
    meta["header-includes"] = pandoc.MetaBlocks({tcolorbox_pkg})
  elseif header_includes.tag == "MetaBlocks" then
    header_includes:insert(tcolorbox_pkg)
  elseif header_includes.tag == "MetaList" then
    header_includes:insert(pandoc.MetaBlocks({tcolorbox_pkg}))
  else
    meta["header-includes"] = pandoc.MetaList({
      header_includes,
      pandoc.MetaBlocks({tcolorbox_pkg})
    })
  end

  return meta
end

--- Render admonition for LaTeX/PDF output.
local function render_latex(el, admon_type, title)
  local style = admonition_types[admon_type]
  local border_rgb = hex_to_latex_rgb(style.border)
  local bg_rgb = hex_to_latex_rgb(style.bg)
  local color_name_border = "admon" .. admon_type .. "border"
  local color_name_bg = "admon" .. admon_type .. "bg"

  local open = string.format(
    "\\definecolor{%s}{rgb}{%s}\n" ..
    "\\definecolor{%s}{rgb}{%s}\n" ..
    "\\begin{tcolorbox}[" ..
      "colback=%s," ..
      "colframe=%s," ..
      "coltitle=black," ..
      "title={\\textbf{%s}}," ..
      "fonttitle=\\sffamily," ..
      "left=2mm," ..
      "right=2mm," ..
      "top=1mm," ..
      "bottom=1mm," ..
      "boxrule=0.5mm," ..
      "arc=1mm" ..
    "]",
    color_name_border, border_rgb,
    color_name_bg, bg_rgb,
    color_name_bg,
    color_name_border,
    title
  )

  local close = "\\end{tcolorbox}"

  local result = pandoc.List()
  result:insert(pandoc.RawBlock("latex", open))
  for _, block in ipairs(el.content) do
    result:insert(block)
  end
  result:insert(pandoc.RawBlock("latex", close))
  return result
end

--- Render admonition for HTML/EPUB output.
local function render_html(el, admon_type, title)
  local style = admonition_types[admon_type]

  local open_div = string.format(
    '<div class="admonition admonition-%s" style="' ..
      "background-color: %s; " ..
      "border-left: 4px solid %s; " ..
      "padding: 12px 16px; " ..
      "margin: 16px 0; " ..
      "border-radius: 4px;" ..
    '">\n' ..
    '<p style="' ..
      "margin: 0 0 8px 0; " ..
      "font-weight: bold; " ..
      "color: %s;" ..
    '">%s</p>',
    admon_type, style.bg, style.border, style.border, title
  )

  local close_div = "</div>"

  local result = pandoc.List()
  result:insert(pandoc.RawBlock("html", open_div))
  for _, block in ipairs(el.content) do
    result:insert(block)
  end
  result:insert(pandoc.RawBlock("html", close_div))
  return result
end

--- Render admonition for DOCX output.
--- Uses a bold title paragraph and custom-style attribute.
local function render_docx(el, admon_type, title)
  local title_para = pandoc.Para({
    pandoc.Strong({pandoc.Str(title)})
  })

  -- Insert the title as the first block
  el.content:insert(1, title_para)

  -- Set a custom style that users can define in their reference doc
  el.attributes["custom-style"] = "Admonition"

  return el
end

--- Render admonition for reStructuredText output.
local function render_rst(el, admon_type, title)
  -- RST supports: note, tip, warning, danger, caution, important, hint, attention, error
  local rst_type_map = {
    note = "note",
    tip = "tip",
    info = "hint",
    warning = "warning",
    danger = "danger",
    caution = "caution",
  }
  local rst_type = rst_type_map[admon_type] or "note"
  local default_label = admonition_types[admon_type].label

  local content_str = pandoc.write(pandoc.Pandoc(el.content), "rst")
  -- Indent content for RST directive
  local indented = content_str:gsub("([^\n]+)", "   %1")

  local directive
  if title ~= default_label then
    directive = string.format(".. %s:: %s\n\n%s\n", rst_type, title, indented)
  else
    directive = string.format(".. %s::\n\n%s\n", rst_type, indented)
  end

  return pandoc.List({pandoc.RawBlock("rst", directive)})
end

--- Render admonition for AsciiDoc output.
local function render_asciidoc(el, admon_type, title)
  local asciidoc_type_map = {
    note = "NOTE",
    tip = "TIP",
    info = "NOTE",
    warning = "WARNING",
    danger = "CAUTION",
    caution = "CAUTION",
  }
  local atype = asciidoc_type_map[admon_type] or "NOTE"
  local default_label = admonition_types[admon_type].label

  local content_str = pandoc.write(pandoc.Pandoc(el.content), "asciidoc")

  local block
  if title ~= default_label then
    block = string.format("[%s]\n.%s\n====\n%s\n====\n", atype, title, content_str)
  else
    block = string.format("[%s]\n====\n%s\n====\n", atype, content_str)
  end

  return pandoc.List({pandoc.RawBlock("asciidoc", block)})
end

--- Render admonition for DocBook output.
local function render_docbook(el, admon_type, title)
  local docbook_type_map = {
    note = "note",
    tip = "tip",
    info = "important",
    warning = "warning",
    danger = "caution",
    caution = "caution",
  }
  local dtype = docbook_type_map[admon_type] or "note"
  local default_label = admonition_types[admon_type].label

  local content_str = pandoc.write(pandoc.Pandoc(el.content), "docbook5")

  local title_xml = ""
  if title ~= default_label then
    title_xml = string.format("  <title>%s</title>\n", title)
  end

  local block = string.format(
    "<%s>\n%s%s</%s>\n",
    dtype, title_xml, content_str, dtype
  )

  return pandoc.List({pandoc.RawBlock("docbook5", block)})
end

--- Track metadata for LaTeX header injection.
local needs_tcolorbox = false

function Div(el)
  local admon_type = get_admonition_type(el)
  if not admon_type then
    return nil
  end

  local title = get_title(el, admon_type)

  if FORMAT:match("latex") or FORMAT:match("pdf") or FORMAT:match("beamer") then
    needs_tcolorbox = true
    return render_latex(el, admon_type, title)
  elseif FORMAT:match("html") or FORMAT:match("epub") then
    return render_html(el, admon_type, title)
  elseif FORMAT:match("docx") then
    return render_docx(el, admon_type, title)
  elseif FORMAT:match("rst") then
    return render_rst(el, admon_type, title)
  elseif FORMAT:match("asciidoc") then
    return render_asciidoc(el, admon_type, title)
  elseif FORMAT:match("docbook") then
    return render_docbook(el, admon_type, title)
  end

  -- For unsupported formats, leave the div unchanged
  return nil
end

function Meta(meta)
  if needs_tcolorbox then
    return ensure_tcolorbox(meta)
  end
  return meta
end

--- Ensure Meta runs after Div so we know if tcolorbox is needed.
return {
  { Div = Div },
  { Meta = Meta },
}
