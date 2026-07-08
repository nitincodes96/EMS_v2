import { randomUUID } from "crypto"
import path from "path"
import fs from "fs/promises"

export async function saveUploadedFile(file: File, subfolder: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = path.extname(file.name) || ""
  const filename = `${randomUUID()}${ext}`
  const dir = path.join(process.cwd(), "uploads", subfolder)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, filename), buffer)
  return `/api/upload/${subfolder}/${filename}`
}
