"use client"

import { TeamRoster } from "@/components/users/team-roster"

export default function ModeratorTeamPage() {
  return (
    <TeamRoster
      scope="organization"
      description={() =>
        "Faculty and project assistants across every department. Filter by department to narrow the list."
      }
    />
  )
}
