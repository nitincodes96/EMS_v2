"use client"

import { TeamRoster } from "@/components/users/team-roster"

export default function FacultyTeamPage() {
  return (
    <TeamRoster
      description={(department) =>
        `Everyone in ${department} — the project assistants you can book, and your fellow faculty.`
      }
    />
  )
}
