//
// Copyright © 2022 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { getCategories } from '@anticrm/skillset'
import core, { Ref, TxOperations } from '@hcengineering/core'
import {
  MigrateOperation,
  MigrationClient,
  MigrationUpgradeClient,
  createOrUpdate,
  tryUpgrade
} from '@hcengineering/model'
import tags, { TagCategory } from '@hcengineering/model-tags'
import { createProjectType, createSequence } from '@hcengineering/model-task'
import tracker from '@hcengineering/model-tracker'
import { recruitId } from '@hcengineering/recruit'
import task, { ProjectType } from '@hcengineering/task'
import { PaletteColorIndexes } from '@hcengineering/ui/src/colors'
import recruit from './plugin'

export const recruitOperation: MigrateOperation = {
  async migrate (client: MigrationClient): Promise<void> {},
  async upgrade (client: MigrationUpgradeClient): Promise<void> {
    const tx = new TxOperations(client, core.account.System)
    await createDefaults(tx)

    await tryUpgrade(client, recruitId, [
      {
        state: 'related-targets',
        func: async (client): Promise<void> => {
          const ops = new TxOperations(client, core.account.ConfigUser)
          await ops.createDoc(tracker.class.RelatedIssueTarget, core.space.Configuration, {
            rule: {
              kind: 'classRule',
              ofClass: recruit.class.Vacancy
            }
          })

          await ops.createDoc(tracker.class.RelatedIssueTarget, core.space.Configuration, {
            rule: {
              kind: 'classRule',
              ofClass: recruit.class.Applicant
            }
          })
        }
      }
    ])
  }
}

async function createDefaults (tx: TxOperations): Promise<void> {
  await createSpaces(tx)

  await createOrUpdate(
    tx,
    tags.class.TagCategory,
    tags.space.Tags,
    {
      icon: recruit.icon.Skills,
      label: 'Other',
      targetClass: recruit.mixin.Candidate,
      tags: [],
      default: true
    },
    recruit.category.Other
  )

  for (const c of getCategories()) {
    await createOrUpdate(
      tx,
      tags.class.TagCategory,
      tags.space.Tags,
      {
        icon: recruit.icon.Skills,
        label: c.label,
        targetClass: recruit.mixin.Candidate,
        tags: c.skills,
        default: false
      },
      (recruit.category.Category + '.' + c.id) as Ref<TagCategory>
    )
  }

  await createSequence(tx, recruit.class.Review)
  await createSequence(tx, recruit.class.Opinion)
  await createSequence(tx, recruit.class.Applicant)
  await createSequence(tx, recruit.class.Vacancy)
  await createDefaultKanbanTemplate(tx)
}

async function createDefaultKanbanTemplate (tx: TxOperations): Promise<Ref<ProjectType>> {
  return await createProjectType(
    tx,
    {
      name: 'Default vacancy',
      category: recruit.category.VacancyTypeCategories,
      description: ''
    },
    [
      {
        color: PaletteColorIndexes.Coin,
        name: 'HR Interview',
        ofAttribute: recruit.attribute.State,
        category: task.statusCategory.Active
      },
      {
        color: PaletteColorIndexes.Cerulean,
        name: 'Technical Interview',
        ofAttribute: recruit.attribute.State,
        category: task.statusCategory.Active
      },
      {
        color: PaletteColorIndexes.Waterway,
        name: 'Test task',
        ofAttribute: recruit.attribute.State,
        category: task.statusCategory.Active
      },
      {
        color: PaletteColorIndexes.Grass,
        name: 'Offer',
        ofAttribute: recruit.attribute.State,
        category: task.statusCategory.Active
      },
      { name: 'Won', ofAttribute: recruit.attribute.State, category: task.statusCategory.Won },
      { name: 'Lost', ofAttribute: recruit.attribute.State, category: task.statusCategory.Lost }
    ],
    recruit.template.DefaultVacancy
  )
}

async function createSpaces (tx: TxOperations): Promise<void> {
  const current = await tx.findOne(core.class.Space, {
    _id: recruit.space.CandidatesPublic
  })
  if (current === undefined) {
    await tx.createDoc(
      recruit.class.Candidates,
      core.space.Space,
      {
        name: 'public',
        description: 'Public Candidates',
        private: false,
        members: [],
        archived: false
      },
      recruit.space.CandidatesPublic
    )
  }

  const currentReviews = await tx.findOne(core.class.Space, {
    _id: recruit.space.Reviews
  })
  if (currentReviews === undefined) {
    await tx.createDoc(
      core.class.Space,
      core.space.Space,
      {
        name: 'Reviews',
        description: 'Public reviews',
        private: false,
        members: [],
        archived: false
      },
      recruit.space.Reviews
    )
  } else if (currentReviews.private) {
    await tx.update(currentReviews, { private: false })
  }
}
