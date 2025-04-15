EVENTS_DIR = 'data/events'
CONTROL_LABEL = 'No AI'
TREATMENT_LABEL = 'AI'

bad_users = [
    'u-admin',
    'p-admin',
    'u-8dfd8fe2-1e62-4408-94cc-03c18574a71d',
    'u-f5995843-72d9-44aa-998e-565017d8ae3d',
    'u-e6a2c890-8998-43fc-90c4-68d19cfcca2b',
    'u-ea64153b-fee6-4a4c-b9a5-9f47a94f2008',
    'u-a80ca38e-a9e1-4d71-af07-c65f1b28c1c7',
    'u-12d4be3e-3310-4c88-80d6-6746453e1847',
    'u-55fd2799-4fa7-47e2-a745-779ac2ebf8c7',
    'u-38a73037-9f3d-41dd-a7ba-80edf328e65b',
    'u-26940e37-c0a9-4ae7-8b17-b1a0f4f1b9b8', # garbage
    'u-c1c97b15-8da0-42d7-a86e-953f29a6939e', # copied from wikipedia
    'u-3ec54d56-4833-48e6-916a-4132a99c46fb', # copied from the web
    'u-e6bbdb22-08ec-4248-b6ed-f7c1a74a8501', # copied from the web
    'u-bd9d022b-f99f-4d8f-adba-ceb07acab6d3', # garbage
    'u-fb3ac03d-c893-4caa-80ff-f99a72f73112', # irrelevant responses
    'u-5ef1e284-3417-43d3-ba88-0c6a16cdafce', # repetitive responses
    'u-fc05ed04-3fb9-4159-bccc-a0e2ae69717e', # repetitive responses
    'u-ff9daa9f-082c-4d8b-849e-2d76a71c46b1', # repetitive responses
    'p-65f3beac5e96144b7402ae9c', # repeated
    'p-65f99e25229875e7c5835926', # system malfunctioned
    'p-6668405472e9247b8e35c21f', # multiple entries
]

# Some Prolific user refreshed the page and started the study again, which gave them a u- code instead of a p- code
# This maps their u- code with their p- code (known through Prolific)
u2p_mapping = {
    'u-d9030fd9-0f53-4081-a9a6-cfcbef4b27ae': 'p-66915ec0b6482e96d4850e7d',
    'u-7ea0f36a-7324-4395-aaef-7ab82d215bcc': 'p-5e3f4c676d06fc1b240e6021',
    'u-85379a99-5799-4682-b1f7-3652f5ce6cce': 'p-6668405472e9247b8e35c21f',
}