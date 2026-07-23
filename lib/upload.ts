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

export async function deleteUploadedFile(url?: string | null): Promise<void> {
  if (!url || !url.startsWith("/api/upload/")) return
  const relativePath = url.replace("/api/upload/", "")
  const filePath = path.join(process.cwd(), "uploads", relativePath)
  if (!filePath.startsWith(path.join(process.cwd(), "uploads"))) return
  try {
    await fs.unlink(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to delete uploaded file:", error)
    }
  }
}
