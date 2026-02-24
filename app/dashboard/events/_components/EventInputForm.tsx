import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import React from 'react'

interface Props {
    label: string;
    placeholder: string;
}

export const EventInputForm = ({ label, placeholder }: Props) => {
  return (
    <div className="space-y-2">
    <Label htmlFor="title">{label}</Label>
    <Input
      id="title"
      placeholder={placeholder}
    />
  </div>
  )
}