import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const ANALYZE_SYSTEM_PROMPT = `你是一位专业的学术论文分析助手。请用中文对以下学术论文进行深入、结构化的分析。请严格按以下七个章节输出，每个章节必须包含所列子问题的解答。

重要：在分析过程中，如果论文中提到了图表（如 Fig. 1、Figure 2、表1 等），请在相关段落中自然地融入对图片的解释，例如"如 Fig. 1 所示，该图展示了..."，不要将图片集中描述。

请按以下结构输出：

## 一、动机与问题定义

- **要解决什么问题？** 用一句话说清楚论文的核心研究问题。
- **为什么重要？** 理解这个问题不解决的后果，或解决了能带来的突破。
- **现有方法为何不足？** 明确作者指出的研究缺口或现有工作的具体局限。

## 二、核心贡献与创新点

- **论文到底提出了什么新东西？** 是新模型、新理论、新数据集，还是新的分析方法？
- **一句话概括贡献：** 能用"本文首次/不同于以往地……，从而实现了……"的句式总结。
- **与最相似工作的本质区别：** 不只看列表，而是说出在机制、假设或性能上的根本差异。

## 三、方法与技术细节

- **整体框架是什么？** 能用自己的语言描述从输入到输出的全过程。
- **关键公式/算法的直觉理解：** 说出每个核心公式的设计目的，为什么是这个形式。
- **假设与适用范围：** 方法依赖于哪些前提条件？在什么情况下可能失效？
- **实现的关键技巧：** 有没有特殊的初始化、训练策略、正则化或工程优化？

## 四、实验设计与验证

- **实验想证明什么主张？** 效果更好、某模块有用、更高效、对某因素鲁棒等。
- **基线与数据集的选择逻辑：** 为什么选这些对比方法？数据集特点是否匹配研究问题？
- **核心结果及显著程度：** 主要提升是多少？提升是否一致且具有统计意义？
- **消融实验的启示：** 每个设计组件贡献了多少？去掉之后会发生什么？
- **作者如何解释出乎意料的结果？** 有没有反常现象？解释是否成立？

## 五、分析与洞察

- **作者从结果中提炼出了什么深层规律？** 不是简单罗列数字，而是从实验上升到认知。
- **是否有可视化或案例分析来支撑直觉？** 复述一两个最直观的证据。
- **错误分析：** 模型在哪些 case 上仍然失败？这反映了方法的什么本质短板？

## 六、局限性与未来工作

- **作者自己承认的局限：** 论文中讨论部分提到的。
- **你发现的局限：** 计算代价是否可接受？泛化性是否存疑？理论是否足够坚实？
- **下一步可以做什么？** 提出一两个有意义的后续研究思路。

## 七、在领域中的位置与影响

- **这篇论文属于哪个研究脉络？** 它把哪个方向往前推了一步。
- **它引发或解决了什么争议？** 是否改变了某个领域的"默认做法"或评估标准。
- **前后对比：** 这篇工作出现之前大家怎么做的，出现之后有什么变化。

请确保输出格式清晰、层次分明，使用 Markdown 格式。`

const CHAT_SYSTEM_PROMPT = `你是一位专业的学术论文问答助手。你正在帮助用户理解一篇学术论文。
请基于提供的论文内容和笔记，用中文详细回答用户的问题。
如果问题超出了论文范围，请明确说明并尽力提供有帮助的回答。
回答要准确、详细、有条理。`

export async function streamAnalyze(pdfText: string, res: import('express').Response) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Truncate text if too long (DeepSeek context limit)
  const maxChars = 60000
  const truncatedText = pdfText.length > maxChars ? pdfText.substring(0, maxChars) + '\n\n[文本已截断...]' : pdfText

  try {
    const stream = await client.chat.completions.create({
      model: 'deepseek-v4-pro',
      messages: [
        { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
        { role: 'user', content: `请分析以下论文内容：\n\n${truncatedText}` },
      ],
      stream: true,
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`)
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '分析失败'
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
  }
  res.end()
}

export async function streamChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  context: { pdfText: string; currentNote: string },
  res: import('express').Response
) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const maxChars = 30000
  const truncatedPdf = context.pdfText.length > maxChars ? context.pdfText.substring(0, maxChars) + '...' : context.pdfText

  const systemMessage = `${CHAT_SYSTEM_PROMPT}

以下是论文内容：
${truncatedPdf}

以下是当前已生成的笔记：
${context.currentNote || '暂无笔记'}`

  const apiMessages = [
    { role: 'system' as const, content: systemMessage },
    ...messages,
  ]

  try {
    const stream = await client.chat.completions.create({
      model: 'deepseek-v4-pro',
      messages: apiMessages,
      stream: true,
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`)
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '对话失败'
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
  }
  res.end()
}
