"use client"

import { CalendarDays, Clock, MapPin } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScheduleSettingsForm } from "@/components/admin/schedule-settings-form"
import { AttendanceLocationsForm } from "@/components/admin/attendance-locations-form"
import { HolidaysManager } from "@/components/admin/holidays-manager"

/**
 * Everything that applies to the whole organization rather than one
 * department: working hours & booking rules, geo-fence locations, and the
 * holiday calendar. Departments themselves are just a name and their people.
 */
export default function GlobalSettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Global Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Schedule, geo-fence locations and holidays shared by every department.
        </p>
      </div>

      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="schedule" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" /> Schedule & Booking
          </TabsTrigger>
          <TabsTrigger value="geofence" className="gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" /> Geo-fence
          </TabsTrigger>
          <TabsTrigger value="holidays" className="gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5" /> Holidays
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <div className="max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ScheduleSettingsForm />
          </div>
        </TabsContent>

        <TabsContent value="geofence" className="mt-4">
          <div className="max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <AttendanceLocationsForm />
          </div>
        </TabsContent>

        <TabsContent value="holidays" className="mt-4">
          <div className="max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <HolidaysManager />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
