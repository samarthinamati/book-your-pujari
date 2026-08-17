'use client'

import { useState } from 'react'
// Make sure your supabase client path matches your project setup
// e.g., import { supabase } from '@/lib/supabase'

export default function BookPage() {
  const [name, setName] = useState('')
  const [pujaType, setPujaType] = useState('Griha Pravesh')
  const [loading, setLoading] = useState(false)

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Example Supabase insert call
      // const { error } = await supabase.from('bookings').insert([{ name, puja_type: pujaType }])

      // if (error) {
      //   console.error("Supabase Error:", JSON.stringify(error, null, 2))
      //   alert("Booking failed: " + (error.message || JSON.stringify(error)))
      //   return
      // }

      alert("Booking request sent successfully!")
    } catch (err: any) {
      console.error("Unexpected error:", err)
      alert("An unexpected error occurred: " + (err.message || JSON.stringify(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-xl mx-auto p-6 md:p-12">
      <h1 className="text-3xl font-serif font-bold text-accent mb-6">Book a Pooja</h1>
      <form onSubmit={handleBooking} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Your Name</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            required 
            className="w-full border rounded-lg p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Select Puja</label>
          <select 
            value={pujaType} 
            onChange={(e) => setPujaType(e.target.value)}
            className="w-full border rounded-lg p-2"
          >
            <option value="Griha Pravesh">Griha Pravesh & Vastu Shanti</option>
            <option value="Vivah Sanskar">Vivah & Engagement Sanskar</option>
            <option value="Satyanarayan">Satyanarayan & Monthly Puja</option>
          </select>
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
        >
          {loading ? 'Submitting...' : 'Confirm and Send Request'}
        </button>
      </form>
    </main>
  )
}
