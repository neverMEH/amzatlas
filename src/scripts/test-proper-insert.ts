#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testProperInsert() {
  console.log('🔍 Testing proper insert method...\n')

  try {
    // 1. Check asin_performance_data structure
    const { data: existingSample } = await supabase
      .from('asin_performance_data')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .single()
    
    if (existingSample) {
      console.log('Latest asin_performance_data record:')
      console.log(`  ID: ${existingSample.id}`)
      console.log(`  ASIN: ${existingSample.asin}`)
      console.log(`  Date: ${existingSample.start_date} to ${existingSample.end_date}`)
      
      // Check how search_query_performance links to it
      const { data: linkedRecords } = await supabase
        .from('search_query_performance')
        .select('id, asin_performance_id, search_query, asin')
        .eq('asin_performance_id', existingSample.id)
        .limit(3)
      
      console.log(`\nLinked search_query_performance records (${linkedRecords?.length || 0}):`)
      linkedRecords?.forEach(rec => {
        console.log(`  - Query: "${rec.search_query}", ASIN: ${rec.asin}`)
      })
    }

    // 2. Test if we should insert with ID or let it auto-generate
    console.log('\n🧪 Testing insert without ID:')
    const testRecord = {
      asin: 'B0TEST12345',
      start_date: '2025-08-10',
      end_date: '2025-08-10'
    }
    
    const { data: insertResult, error: insertError } = await supabase
      .from('asin_performance_data')
      .insert(testRecord)
      .select()
    
    if (insertError) {
      console.log('Insert error:', insertError)
      
      // Try with upsert instead
      console.log('\n🧪 Testing upsert:')
      const { data: upsertResult, error: upsertError } = await supabase
        .from('asin_performance_data')
        .upsert(testRecord, {
          onConflict: 'asin,start_date,end_date',
          ignoreDuplicates: false
        })
        .select()
      
      if (upsertError) {
        console.log('Upsert error:', upsertError)
      } else {
        console.log('Upsert successful:', upsertResult)
      }
    } else {
      console.log('Insert successful! Generated ID:', insertResult?.[0]?.id)
      
      // Clean up
      if (insertResult?.[0]?.id) {
        await supabase
          .from('asin_performance_data')
          .delete()
          .eq('id', insertResult[0].id)
        console.log('Cleaned up test record')
      }
    }

    // 3. Check relationship between tables
    console.log('\n📊 Checking how tables relate:')
    const { data: sampleJoin } = await supabase
      .from('search_query_performance')
      .select(`
        id,
        search_query,
        asin,
        asin_performance_id,
        asin_performance_data!inner(
          id,
          asin,
          start_date,
          end_date
        )
      `)
      .limit(2)
    
    if (sampleJoin) {
      console.log('Sample joined data:')
      sampleJoin.forEach((rec: any) => {
        console.log(`\n  Search Query: "${rec.search_query}"`)
        console.log(`  Query ASIN: ${rec.asin}`)
        console.log(`  Performance ID: ${rec.asin_performance_id}`)
        if (rec.asin_performance_data) {
          console.log(`  Parent ASIN: ${rec.asin_performance_data.asin}`)
          console.log(`  Parent Date: ${rec.asin_performance_data.start_date}`)
        }
      })
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the test
testProperInsert()