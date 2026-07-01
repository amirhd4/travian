import { useEffect, useState, useCallback } from 'react'
import { Application } from '@pixi/react'
import { TextStyle } from 'pixi.js'

import api from '../api/axiosConfig'
import useGameStore from '../store/useGameStore'
import ResourceBar from '../components/ResourceBar'
import { useGameWebSocket } from '../hooks/useGameWebSocket'


// کامپوننت هر جایگاه ساختمان
const BuildingSlot = ({ x, y, level, name, onClick }) => {
  const draw = useCallback((g) => {
    g.clear()

    g.beginFill(level > 0 ? 0x5c8a00 : 0xd1d5db)
    g.lineStyle(3, 0x374151)
    g.drawCircle(0, 0, 45)
    g.endFill()
  }, [level])

  return (
    <Container
      x={x}
      y={y}
      interactive
      cursor="pointer"
      onclick={onClick}   // ✅ v8: onclick به جای pointerdown
    >
      <Graphics draw={draw} />

      <Text
        text={level > 0 ? `${name}\nسطح ${level}` : 'جایگاه\nخالی'}
        anchor={0.5}
        style={
          new TextStyle({
            fontSize: 14,
            fill: level > 0 ? '#ffffff' : '#4b5563',
            align: 'center',
            fontWeight: 'bold',
            fontFamily: 'Tahoma',
          })
        }
      />
    </Container>
  )
}

export default function VillageMap() {
  const [buildings, setBuildings] = useState([])
  const setResources = useGameStore((state) => state.updateResources)

  useGameWebSocket()

  const fetchVillageData = async () => {
    try {
      setBuildings([
        { position: 1, level: 5, name: 'چوب‌بری', x: 200, y: 150 },
        { position: 2, level: 0, name: '', x: 400, y: 150 },
        { position: 3, level: 3, name: 'انبار', x: 600, y: 150 },
        { position: 4, level: 0, name: '', x: 300, y: 300 },
        { position: 5, level: 1, name: 'ساختمان اصلی', x: 500, y: 300 },
        { position: 6, level: 2, name: 'پادگان', x: 400, y: 450 },
      ])

      setResources({ wood: 1200, clay: 800, iron: 900, crop: 1500 })
    } catch (err) {
      console.error('خطا در دریافت اطلاعات دهکده', err)
    }
  }

  useEffect(() => {
    fetchVillageData()
  }, [])

  const handleSlotClick = async (position) => {
    const confirmed = window.confirm(
      `آیا می‌خواهید ساختمان جایگاه ${position} را ارتقا دهید؟`
    )

    if (!confirmed) return

    try {
      const response = await api.post('game/upgrade-building/', {
        village_id: 1,
        position,
      })

      alert(response.data.message || 'ارتقا آغاز شد!')
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || 'خطای ناشناخته در ارتباط با سرور'
      alert(`خطا: ${errorMsg}`)
    }
  }

  return (
    <div className="relative w-full h-screen bg-[#c2d79c] flex flex-col justify-center items-center overflow-hidden">
      <ResourceBar />

      <div className="relative border-8 border-[#8B5A2B] rounded-xl shadow-2xl overflow-hidden mt-12 bg-[#e0e6b8]">
        {/* ✅ Pixi v8 Root */}
        <Application>
          {buildings.map((b) => (
            <BuildingSlot
              key={b.position}
              x={b.x}
              y={b.y}
              level={b.level}
              name={b.name}
              onClick={() => handleSlotClick(b.position)}
            />
          ))}
        </Application>
      </div>
    </div>
  )
}