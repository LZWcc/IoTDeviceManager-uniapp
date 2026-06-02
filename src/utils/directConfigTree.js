// 配置树保存前需要做快照，避免 watch 里继续引用同一个对象导致 diff 失效。
export function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function getDefaultValue(node) {
  switch (node.f_type) {
    case "1":
      return Array.isArray(node.f_value) && node.f_value.length > 0
        ? node.f_value[0].value
        : "off"
    case "2":
      return ""
    case "3":
      return Number(node.min) || 0
    case "4":
      return null
    case "5":
      return ""
    default:
      return ""
  }
}

// 后端返回的是配置树，UI 需要每个节点都有可编辑 value；这里只做数据归一化，不触发保存。
export function initConfigNodeValue(node) {
  if (node.f_type === "3") {
    node.min = Number(node.min) || 0
    node.max = Number(node.max) || 100
  }

  const hasValue = node.value !== null && node.value !== undefined && node.value !== ""
  node.value = hasValue ? node.value : getDefaultValue(node)
  if (node.f_type === "3") node.value = Number(node.value)

  if (node.children && node.children.length > 0) {
    node.children.forEach(initConfigNodeValue)
  }
}

export function initConfigTreeValues(list) {
  list.forEach(initConfigNodeValue)
  return list
}

// 自动保存只关心节点值，把树拍平成列表便于和快照按 id 比较。
export function collectConfigValues(nodes) {
  const result = []
  const traverse = (node) => {
    result.push({
      id: node.id,
      t_name: node.t_name,
      f_type: node.f_type,
      value: node.value,
    })
    if (node.children && node.children.length > 0) {
      node.children.forEach(traverse)
    }
  }
  nodes.forEach(traverse)
  return result
}

export function getChangedConfigValues(currentValues, snapshot) {
  if (!snapshot || snapshot.length === 0) return []
  return currentValues.filter((item) => {
    const original = snapshot.find((s) => s.id === item.id)
    return !original || String(original.value) !== String(item.value)
  })
}

// 当前后端保存接口不接受空值作为有效变更；所有类型暂时共用同一条非空规则。
export function isValidConfigValue(item) {
  return item.value !== null && item.value !== undefined && item.value !== ""
}

export function normalizeConfigValueForSubmit(item) {
  let value = item.value
  if (item.f_type === "2" || item.f_type === "3") {
    const intValue = parseInt(value, 10)
    if (Number.isFinite(intValue)) {
      value = intValue
    }
  }
  return { ...item, value }
}
