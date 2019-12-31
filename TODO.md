# TODO list

1. (Jackie) Abnormal Vote handling:
   1. Everyone run Sheriff
   1. Nobody run Sheriff
   1. Sheriff vote tie
   1. Wolf vote tie
   1. vote kill tie

2. (Jingshao) Sheriff died, pass badge or not handling

3. Test
   1. Witch power
      1. Witch save and kill
         1. Wolf kill player-1 in night
         2. Witch should see player-1's name. Witch save player-1 in night
         3. Witch choose player-2 to kill from her list
         4. Verify player-1 is NOT dead in day time
         5. Verify player-2 is DEAD
         6. Wolf kill player-1 in night
         7. Witch should NOT see player-1 name. Witch save player-1 in night
         8. Witch choose player-3 to kill from her list
         9. Verify player-1 is DEAD in day time **FAIL**
         10. Verify player-3 is NOT dead in day time
         11. Wolf kill WITCH in night

      2. Sheriff
         1. Wolf kill player-1 in night
