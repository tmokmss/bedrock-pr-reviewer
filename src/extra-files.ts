import * as fs from 'fs/promises'
import * as path from 'path'

export async function readExtraFiles(
  extraFiles: string[],
  maxBytes = 8192
): Promise<string> {
  let blocks: string[] = []
  for (const file of extraFiles) {
    try {
      const filePath = path.resolve(process.env.GITHUB_WORKSPACE || '.', file)
      const stat = await fs.stat(filePath)
      if (stat.size > maxBytes) {
        console.error(
          `File ${file} is too large (>${maxBytes} bytes), truncating.`
        )
      }
      const content = await fs.readFile(filePath, {encoding: 'utf-8'})
      blocks.push(
        `Follow these rules from ${file}:\n---\n${content.slice(0, maxBytes)}\n---`
      )
    } catch (e) {
      console.error(`Could not read ${file}: ${(e as Error).message}`)
    }
  }
  return blocks.join('\n\n')
}
